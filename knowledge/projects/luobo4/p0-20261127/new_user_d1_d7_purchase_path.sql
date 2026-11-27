-- 萝卜4小游戏37：所选新增批次D1-D7按商品购买人数、去重订单次数。
-- 新增=全历史register最早日期；D1=注册当天；各Dn分别成熟至昨日。
-- 每个Dn成熟新增样本为0时输出NULL；已有成熟样本但未购买商品时输出0。
-- 截至昨日全历史订单先去重，再关联注册日，避免日期筛选截断首日之外订单。
-- 媒体Selector为完整条件，全部=1=1；新增样本和订单使用同一用户媒体映射。
SELECT
    m.product_id AS "商品ID",
    m.product_name AS "商品名称",
    c.n1 AS "D1成熟新增人数",
    CASE WHEN c.n1 > 0 THEN m.u1 END AS "D1购买人数",
    CASE WHEN c.n1 > 0 THEN m.o1 END AS "D1购买次数",
    c.n2 AS "D2成熟新增人数",
    CASE WHEN c.n2 > 0 THEN m.u2 END AS "D2购买人数",
    CASE WHEN c.n2 > 0 THEN m.o2 END AS "D2购买次数",
    c.n3 AS "D3成熟新增人数",
    CASE WHEN c.n3 > 0 THEN m.u3 END AS "D3购买人数",
    CASE WHEN c.n3 > 0 THEN m.o3 END AS "D3购买次数",
    c.n4 AS "D4成熟新增人数",
    CASE WHEN c.n4 > 0 THEN m.u4 END AS "D4购买人数",
    CASE WHEN c.n4 > 0 THEN m.o4 END AS "D4购买次数",
    c.n5 AS "D5成熟新增人数",
    CASE WHEN c.n5 > 0 THEN m.u5 END AS "D5购买人数",
    CASE WHEN c.n5 > 0 THEN m.o5 END AS "D5购买次数",
    c.n6 AS "D6成熟新增人数",
    CASE WHEN c.n6 > 0 THEN m.u6 END AS "D6购买人数",
    CASE WHEN c.n6 > 0 THEN m.o6 END AS "D6购买次数",
    c.n7 AS "D7成熟新增人数",
    CASE WHEN c.n7 > 0 THEN m.u7 END AS "D7购买人数",
    CASE WHEN c.n7 > 0 THEN m.o7 END AS "D7购买次数"
FROM (
    SELECT product_id, product_name,
           count(DISTINCT CASE WHEN new_day = 1 THEN pid END) AS u1,
           count_if(new_day = 1) AS o1,
           count(DISTINCT CASE WHEN new_day = 2 THEN pid END) AS u2,
           count_if(new_day = 2) AS o2,
           count(DISTINCT CASE WHEN new_day = 3 THEN pid END) AS u3,
           count_if(new_day = 3) AS o3,
           count(DISTINCT CASE WHEN new_day = 4 THEN pid END) AS u4,
           count_if(new_day = 4) AS o4,
           count(DISTINCT CASE WHEN new_day = 5 THEN pid END) AS u5,
           count_if(new_day = 5) AS o5,
           count(DISTINCT CASE WHEN new_day = 6 THEN pid END) AS u6,
           count_if(new_day = 6) AS o6,
           count(DISTINCT CASE WHEN new_day = 7 THEN pid END) AS u7,
           count_if(new_day = 7) AS o7
    FROM (
        SELECT p.pid, p.product_id, p.product_name,
               date_diff('day', cohorts.reg_day, p.pay_day) + 1 AS new_day
        FROM (
            SELECT pid, product_id, product_name, pay_day
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
        ) cohorts ON p.pid = cohorts.pid
            AND p.pay_day BETWEEN cohorts.reg_day AND date_add('day', 6, cohorts.reg_day)
        WHERE ${Selector:media}
    ) purchase_days
    GROUP BY product_id, product_name
) m
CROSS JOIN (
    SELECT count_if(reg_day < current_date) AS n1,
           count_if(date_add('day', 1, reg_day) < current_date) AS n2,
           count_if(date_add('day', 2, reg_day) < current_date) AS n3,
           count_if(date_add('day', 3, reg_day) < current_date) AS n4,
           count_if(date_add('day', 4, reg_day) < current_date) AS n5,
           count_if(date_add('day', 5, reg_day) < current_date) AS n6,
           count_if(date_add('day', 6, reg_day) < current_date) AS n7
    FROM (
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
    ) media_cohorts
    WHERE ${Selector:media}
) c
ORDER BY m.product_id, m.product_name
