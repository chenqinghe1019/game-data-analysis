-- 萝卜4小游戏37：新增用户全历史首次有效完成订单，归因至首充前最近进入的关卡。
-- 观察截至昨日；register全历史MIN后再筛选新增日期；支付金额原值为元。
-- 先去重订单、选每人首笔、再将关卡关联压成每人一行，避免金额被关卡记录放大。
-- 媒体Selector是完整条件：全部=1=1，指定媒体=media_name='自然量'等。
SELECT
    first_level AS "首充前最近进入关卡",
    product_id AS "商品ID",
    product_name AS "商品名称",
    count(DISTINCT pid) AS "首充人数",
    cast(round(sum(pay_amount), 2) AS decimal(18,2)) AS "首充金额_元"
FROM (
    SELECT
        f.pid, f.order_key, f.product_id, f.product_name, f.pay_amount,
        coalesce(max_by(l.level_id, ROW(l.level_time, l.level_id)), '未获取') AS first_level
    FROM (
        SELECT p.pid, p.order_key, p.product_id, p.product_name,
               p.pay_amount, p.pay_time
        FROM (
            SELECT d.*,
                   row_number() OVER (
                       PARTITION BY pid
                       ORDER BY pay_time, order_key, product_id, product_name
                   ) AS first_rn
            FROM (
                SELECT pid, order_key, product_id, product_name, pay_amount, pay_time, pay_day
                FROM (
                    SELECT s.*,
                           row_number() OVER (
                               PARTITION BY pid, order_key
                               ORDER BY pay_time, product_id, product_name, pay_amount
                           ) AS order_rn
                    FROM (
                        SELECT cast("#user_id" AS varchar) AS pid,
                               coalesce(nullif(trim(cast(order_id AS varchar)), ''),
                                   concat('__missing__|', cast("#event_time" AS varchar), '|',
                                       coalesce(cast(product_id AS varchar), ''), '|',
                                       coalesce(cast(product_name AS varchar), ''), '|',
                                       cast(pay_amount AS varchar))) AS order_key,
                               cast(product_id AS varchar) AS product_id,
                               coalesce(nullif(cast(product_name AS varchar), ''), '未获取商品名称') AS product_name,
                               try_cast(pay_amount AS double) AS pay_amount,
                               cast("#event_time" AS timestamp) AS pay_time,
                               date("$part_date") AS pay_day
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
            ) d
        ) p
        INNER JOIN (
            SELECT c.pid, c.reg_day,
                   coalesce(u.media_name, '自然量') AS media_name
            FROM (
                SELECT pid, reg_day
                FROM (
                    SELECT pid, reg_day, cast(reg_day AS varchar) AS "$part_date"
                    FROM (
                        SELECT cast("#user_id" AS varchar) AS pid,
                               min(date("$part_date")) AS reg_day
                        FROM ta.v_event_37
                        WHERE "$part_event" = 'register'
                          AND "$part_date" <= cast(date_add('day', -1, current_date) AS varchar)
                          AND "#user_id" IS NOT NULL
                        GROUP BY 1
                    ) all_registration
                ) registration_dates
                WHERE ${PartDate:date1}
            ) c
            LEFT JOIN (
                SELECT cast("#user_id" AS varchar) AS pid,
                       coalesce(max(nullif(cast(ad_platform AS varchar), '')), '自然量') AS media_name
                FROM ta.v_user_37
                WHERE "#user_id" IS NOT NULL
                GROUP BY 1
            ) u ON c.pid = u.pid
        ) cohorts ON p.pid = cohorts.pid AND p.pay_day >= cohorts.reg_day
        WHERE p.first_rn = 1
          AND ${Selector:media}
    ) f
    LEFT JOIN (
        SELECT cast("#user_id" AS varchar) AS pid,
               nullif(trim(cast(level_id AS varchar)), '') AS level_id,
               cast("#event_time" AS timestamp) AS level_time
        FROM ta.v_event_37
        WHERE "$part_event" = 'level_start'
          AND "$part_date" <= cast(date_add('day', -1, current_date) AS varchar)
          AND "#event_time" IS NOT NULL
          AND nullif(trim(cast(level_id AS varchar)), '') IS NOT NULL
    ) l ON f.pid = l.pid AND l.level_time <= f.pay_time
    GROUP BY f.pid, f.order_key, f.product_id, f.product_name, f.pay_amount
) first_payment_level
GROUP BY first_level, product_id, product_name
ORDER BY
    CASE WHEN first_level = '未获取' THEN 1 ELSE 0 END,
    try_cast(split_part(first_level, '.', 1) AS bigint) ASC NULLS LAST,
    try_cast(split_part(first_level, '.', 2) AS bigint) ASC NULLS FIRST,
    first_level, product_id, product_name
