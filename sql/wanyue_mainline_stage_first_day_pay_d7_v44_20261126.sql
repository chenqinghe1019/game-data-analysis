WITH
-- 1. 正式服新增角色
user_raw AS (
    SELECT DISTINCT
        CAST("#account_id" AS varchar) AS account_id,
        CAST(
            DATE(FROM_UNIXTIME(TRY_CAST(create_role_time AS double)))
            AS varchar
        ) AS "$part_date"
    FROM ta.v_user_44
    WHERE domain = 'release'
      AND "#account_id" IS NOT NULL
      AND create_role_time IS NOT NULL
),

-- 2. 新增日期筛选
cohort AS (
    SELECT
        account_id,
        DATE("$part_date") AS new_date
    FROM user_raw
    WHERE ${PartDate:date1}
),

-- 3. 首日付费
first_pay AS (
    SELECT
        c.account_id,
        SUM(COALESCE(TRY_CAST(e.payment AS double), 0))
            / 100.0000 AS first_day_pay
    FROM cohort c
    INNER JOIN ta.v_event_44 e
        ON c.account_id = CAST(e."#account_id" AS varchar)
       AND DATE(e."$part_date") = c.new_date
    WHERE e."$part_event" = 'pay_log'
      AND TRY_CAST(e.payment AS double) > 0
    GROUP BY 1
),

-- 4. 首日付费分层
user_level AS (
    SELECT
        c.account_id,
        c.new_date,
        CASE
            WHEN COALESCE(p.first_day_pay, 0) = 0 THEN 'a_free'
            WHEN p.first_day_pay <= 6 THEN 'b_(0,6]'
            WHEN p.first_day_pay <= 30 THEN 'c_(6,30]'
            WHEN p.first_day_pay <= 100 THEN 'd_(30,100]'
            WHEN p.first_day_pay <= 300 THEN 'e_(100,300]'
            WHEN p.first_day_pay <= 500 THEN 'f_(300,500]'
            WHEN p.first_day_pay <= 1000 THEN 'g_(500,1000]'
            ELSE 'h_(1000,+)'
        END AS pay_level,
        CASE
            WHEN COALESCE(p.first_day_pay, 0) = 0 THEN 1
            WHEN p.first_day_pay <= 6 THEN 2
            WHEN p.first_day_pay <= 30 THEN 3
            WHEN p.first_day_pay <= 100 THEN 4
            WHEN p.first_day_pay <= 300 THEN 5
            WHEN p.first_day_pay <= 500 THEN 6
            WHEN p.first_day_pay <= 1000 THEN 7
            ELSE 8
        END AS pay_sort
    FROM cohort c
    LEFT JOIN first_pay p
        ON c.account_id = p.account_id
),

-- 5. 前7日主线战斗记录
battle_raw AS (
    SELECT
        u.new_date,
        u.account_id,
        u.pay_level,
        u.pay_sort,
        TRY_CAST(e.map_id AS bigint) AS map_id,
        e."$part_event" AS event_name,
        e."#event_time" AS event_time,
        NULLIF(TRIM(CAST(e.battle_uid AS varchar)), '') AS battle_uid,
        LOWER(TRIM(CAST(e.battle_result AS varchar))) AS result,
        TRY_CAST(e.fighting_power AS double) AS power
    FROM user_level u
    INNER JOIN ta.v_event_44 e
        ON u.account_id = CAST(e."#account_id" AS varchar)
       AND DATE(e."$part_date")
           BETWEEN u.new_date
               AND DATE_ADD('day', 6, u.new_date)
    WHERE e."$part_event" IN (
        'battle_star',
        'battle_start',
        'battle_result'
    )
      AND TRY_CAST(e.battle_type AS bigint) = 20
      AND TRY_CAST(e.map_id AS bigint) IS NOT NULL
      AND DATE(e."$part_date") < CURRENT_DATE
),

-- 6. 同一场战斗按battle_uid合并
battle_uid_group AS (
    SELECT
        new_date,
        account_id,
        pay_level,
        pay_sort,
        map_id,
        COALESCE(
            battle_uid,
            CONCAT(
                '__missing__',
                CAST(event_time AS varchar),
                '_',
                event_name
            )
        ) AS battle_key,
        MIN(event_time) AS battle_time,
        MAX(
            CASE
                WHEN event_name IN ('battle_star', 'battle_start')
                THEN 1 ELSE 0
            END
        ) AS has_start,
        MAX(
            CASE WHEN event_name = 'battle_result'
            THEN 1 ELSE 0 END
        ) AS has_result,
        MAX(
            CASE
                WHEN event_name = 'battle_result'
                 AND result = 'win'
                THEN 1 ELSE 0
            END
        ) AS normal_pass,
        MAX(
            CASE
                WHEN event_name = 'battle_result'
                 AND result = '2'
                THEN 1 ELSE 0
            END
        ) AS is_skip,
        MAX(
            CASE
                WHEN event_name = 'battle_result'
                 AND result = 'win'
                THEN power
            END
        ) AS pass_power
    FROM battle_raw
    GROUP BY
        new_date,
        account_id,
        pay_level,
        pay_sort,
        map_id,
        COALESCE(
            battle_uid,
            CONCAT(
                '__missing__',
                CAST(event_time AS varchar),
                '_',
                event_name
            )
        )
),

-- 7. 前7日每个玩家每关的挑战顺序
battle_rank AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY
                new_date,
                account_id,
                map_id
            ORDER BY battle_time, battle_key
        ) AS challenge_rank
    FROM battle_uid_group
    WHERE has_start = 1
       OR has_result = 1
),

-- 8. 玩家前7日每关统计
player_map AS (
    SELECT
        new_date,
        account_id,
        pay_level,
        pay_sort,
        map_id,
        COUNT(*) AS challenge_cnt,
        SUM(
            CASE
                WHEN normal_pass = 1 OR is_skip = 1
                THEN 1 ELSE 0
            END
        ) AS pass_cnt,
        MAX(
            CASE
                WHEN challenge_rank = 1
                 AND (normal_pass = 1 OR is_skip = 1)
                THEN 1 ELSE 0
            END
        ) AS first_pass,
        MAX(
            CASE
                WHEN normal_pass = 1 OR is_skip = 1
                THEN 1 ELSE 0
            END
        ) AS total_pass,
        MAX(is_skip) AS skip_flag,
        MIN_BY(pass_power, battle_time)
            FILTER (WHERE pass_power IS NOT NULL)
            AS first_pass_power
    FROM battle_rank
    GROUP BY
        new_date,
        account_id,
        pay_level,
        pay_sort,
        map_id
),

-- 9. 按新增日期、付费分层、关卡汇总
agg AS (
    SELECT
        CASE
            WHEN GROUPING(new_date) = 1 THEN '汇总'
            ELSE CAST(new_date AS varchar)
        END AS new_date_label,
        CASE
            WHEN GROUPING(new_date) = 1 THEN 0
            ELSE 1
        END AS date_sort,
        CASE
            WHEN GROUPING(pay_level) = 1 THEN '汇总'
            ELSE pay_level
        END AS pay_level_label,
        CASE
            WHEN GROUPING(pay_level) = 1 THEN 0
            ELSE pay_sort
        END AS pay_sort_value,
        map_id,

        COUNT(DISTINCT account_id) AS challenge_users,
        COUNT(DISTINCT CASE
            WHEN first_pass = 1 THEN account_id
        END) AS first_pass_users,
        COUNT(DISTINCT CASE
            WHEN total_pass = 1 THEN account_id
        END) AS total_pass_users,
        COUNT(DISTINCT CASE
            WHEN skip_flag = 1 THEN account_id
        END) AS skip_users,
        COUNT(DISTINCT CASE
            WHEN challenge_cnt >= 2 THEN account_id
        END) AS repeat_2_users,
        COUNT(DISTINCT CASE
            WHEN challenge_cnt >= 3 THEN account_id
        END) AS repeat_3_users,

        SUM(challenge_cnt) AS challenge_count,
        SUM(pass_cnt) AS pass_count,

        ROUND(MIN(first_pass_power), 2) AS p0_power,
        ROUND(APPROX_PERCENTILE(first_pass_power, 0.25), 2) AS p25_power,
        ROUND(APPROX_PERCENTILE(first_pass_power, 0.50), 2) AS p50_power,
        ROUND(APPROX_PERCENTILE(first_pass_power, 0.75), 2) AS p75_power,
        ROUND(MAX(first_pass_power), 2) AS p100_power

    FROM player_map
    GROUP BY GROUPING SETS (
        (new_date, pay_level, pay_sort, map_id),
        (new_date, map_id),
        (pay_level, pay_sort, map_id),
        (map_id)
    )
),

-- 10. 新增日期范围
date_range AS (
    SELECT
        MIN(new_date) AS min_date,
        MAX(new_date) AS max_date
    FROM cohort
)

-- 11. 最终输出
SELECT
    ROW_NUMBER() OVER (
        ORDER BY
            a.date_sort,
            TRY_CAST(a.new_date_label AS date) DESC,
            a.pay_sort_value,
            a.map_id
    ) AS "序号",

    CASE
        WHEN a.date_sort = 0
        THEN CONCAT(
            '新增区间 ',
            CAST(d.min_date AS varchar),
            '至',
            CAST(d.max_date AS varchar)
        )
        ELSE a.new_date_label
    END AS "新增日期",

    a.pay_level_label AS "首日付费分层",
    CAST(a.map_id AS varchar) AS "关卡ID",

    a.challenge_users AS "挑战人数",
    a.first_pass_users AS "首次挑战通关人数",
    a.total_pass_users AS "总通关人数",
    a.skip_users AS "跳关人数",

    CAST(ROUND(
        a.first_pass_users * 1.0000
        / NULLIF(a.challenge_users, 0), 4
    ) AS decimal(18,4)) AS "首次挑战通关率",

    CAST(ROUND(
        a.total_pass_users * 1.0000
        / NULLIF(a.challenge_users, 0), 4
    ) AS decimal(18,4)) AS "人数通关率",

    CAST(ROUND(
        a.skip_users * 1.0000
        / NULLIF(a.challenge_users, 0), 4
    ) AS decimal(18,4)) AS "人数跳关率",

    CAST(ROUND(
        a.skip_users * 1.0000
        / NULLIF(a.total_pass_users, 0), 4
    ) AS decimal(18,4)) AS "跳关人数占通关比",

    a.repeat_2_users AS "重复2次挑战人数",

    CAST(ROUND(
        a.repeat_2_users * 1.0000
        / NULLIF(a.challenge_users, 0), 4
    ) AS decimal(18,4)) AS "玩家重复2次挑战率",

    a.repeat_3_users AS "重复3次挑战人数",

    CAST(ROUND(
        a.repeat_3_users * 1.0000
        / NULLIF(a.challenge_users, 0), 4
    ) AS decimal(18,4)) AS "玩家重复3次挑战率",

    a.challenge_count AS "挑战次数",
    a.pass_count AS "总通关次数",

    CAST(ROUND(
        a.pass_count * 1.0000
        / NULLIF(a.challenge_count, 0), 4
    ) AS decimal(18,4)) AS "次数通关率",

    a.p0_power AS "P0通关战力",
    a.p25_power AS "P25通关战力",
    a.p50_power AS "P50通关战力",
    a.p75_power AS "P75通关战力",
    a.p100_power AS "P100通关战力"

FROM agg a
CROSS JOIN date_range d
ORDER BY
    a.date_sort,
    TRY_CAST(a.new_date_label AS date) DESC,
    a.pay_sort_value,
    a.map_id;