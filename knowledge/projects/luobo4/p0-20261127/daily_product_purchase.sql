-- 萝卜4小游戏37：每日商品购买，正金额完成订单按用户+订单号去重，金额为元。
-- 全部统计截至昨日；媒体Selector完整条件在两个media_name作用域分别应用。
-- GROUPING SETS同次聚合产生商品与当日全商品总计；总计在商品筛选之前求出。
-- 付费率分母为login当日#user_id去重；商品人数占比分母为当日全部商品付费人数。
SELECT
    p.day AS "日期",
    p.product_id AS "商品ID",
    p.product_name AS "商品名称",
    p.payers AS "付费人数",
    p.orders AS "付费次数",
    cast(round(p.payers * 1.0000 / nullif(a.active_users, 0), 4) AS decimal(18,4)) AS "付费率",
    cast(round(p.payers * 1.0000 / nullif(p.total_payers, 0), 4) AS decimal(18,4)) AS "付费人数占比",
    cast(round(p.amount, 2) AS decimal(18,2)) AS "付费金额_元",
    cast(round(p.amount / nullif(p.total_amount, 0), 4) AS decimal(18,4)) AS "付费金额占比",
    cast(round(p.amount / nullif(p.payers, 0), 2) AS decimal(18,2)) AS "付费ARPPU_元"
FROM (
    SELECT day, product_id, product_name, payers, orders, amount, is_total,
           max(CASE WHEN is_total = 1 THEN payers END) OVER (PARTITION BY day) AS total_payers,
           max(CASE WHEN is_total = 1 THEN amount END) OVER (PARTITION BY day) AS total_amount
    FROM (
        SELECT day, product_id, product_name,
               grouping(product_id) AS is_total,
               count(DISTINCT pid) AS payers,
               count(*) AS orders,
               sum(pay_amount) AS amount
        FROM (
            SELECT d.pid, d.day, d.product_id, d.product_name, d.pay_amount,
                   coalesce(u.media_name, '自然量') AS media_name
            FROM (
                SELECT pid, date("$part_date") AS day, product_id, product_name, pay_amount
                FROM (
                    SELECT s.*,
                           row_number() OVER (
                               PARTITION BY pid, order_key
                               ORDER BY pay_time, product_id, product_name, pay_amount
                           ) AS order_rn
                    FROM (
                        SELECT cast("#user_id" AS varchar) AS pid,
                               "$part_date",
                               coalesce(nullif(trim(cast(order_id AS varchar)), ''),
                                   concat('__missing__|', cast("#event_time" AS varchar), '|',
                                       coalesce(cast(product_id AS varchar), ''), '|',
                                       coalesce(cast(product_name AS varchar), ''), '|',
                                       cast(pay_amount AS varchar))) AS order_key,
                               cast(product_id AS varchar) AS product_id,
                               coalesce(nullif(cast(product_name AS varchar), ''), '未获取商品名称') AS product_name,
                               try_cast(pay_amount AS double) AS pay_amount,
                               cast("#event_time" AS timestamp) AS pay_time
                        FROM ta.v_event_37
                        WHERE "$part_event" = 'order_finish'
                          AND "$part_date" <= cast(date_add('day', -1, current_date) AS varchar)
                          AND date("#event_time") < current_date
                          AND "#user_id" IS NOT NULL
                          AND "#event_time" IS NOT NULL
                          AND try_cast(pay_amount AS double) > 0
                    ) s
                ) ranked_orders
                WHERE order_rn = 1
                  AND ${PartDate:date}
            ) d
            LEFT JOIN (
                SELECT cast("#user_id" AS varchar) AS pid,
                       coalesce(max(nullif(cast(ad_platform AS varchar), '')), '自然量') AS media_name
                FROM ta.v_user_37
                WHERE "#user_id" IS NOT NULL
                GROUP BY 1
            ) u ON d.pid = u.pid
        ) media_orders
        WHERE ${Selector:media}
        GROUP BY GROUPING SETS ((day, product_id, product_name), (day))
    ) daily_grouping
) p
LEFT JOIN (
    SELECT day, count(DISTINCT pid) AS active_users
    FROM (
        SELECT e."$part_date" AS day_string,
               date(e."$part_date") AS day,
               cast(e."#user_id" AS varchar) AS pid,
               coalesce(u.media_name, '自然量') AS media_name
        FROM ta.v_event_37 e
        LEFT JOIN (
            SELECT cast("#user_id" AS varchar) AS pid,
                   coalesce(max(nullif(cast(ad_platform AS varchar), '')), '自然量') AS media_name
            FROM ta.v_user_37
            WHERE "#user_id" IS NOT NULL
            GROUP BY 1
        ) u ON cast(e."#user_id" AS varchar) = u.pid
        WHERE e."$part_event" = 'login'
          AND e."$part_date" <= cast(date_add('day', -1, current_date) AS varchar)
          AND e."#user_id" IS NOT NULL
          AND ${PartDate:date}
    ) media_active
    WHERE ${Selector:media}
    GROUP BY day
) a ON p.day = a.day
WHERE p.is_total = 0
ORDER BY p.day DESC, p.amount DESC, p.product_id, p.product_name
