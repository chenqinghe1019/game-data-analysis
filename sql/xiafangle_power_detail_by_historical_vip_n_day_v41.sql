SELECT
    row_number() OVER (
        ORDER BY
            r."历史VIP",
            r."新增天数",
            r."新增N天最高战力" DESC,
            r."账号ID"
    ) AS "序号",
    r."新增日期",
    r."新增第N天日期",
    r."新增天数",
    r."历史VIP",
    r."用户ID",
    r."账号ID",
    r."角色名",
    r."服务器ID",
    round(r."新增N天最高战力", 2) AS "新增N天最高战力",
    r."最高战力时间",
    r."VIP样本人数",
    round(r."VIP平均最高战力", 2) AS "VIP平均最高战力",
    round(r."P0战力", 2) AS "P0战力",
    round(r."P25战力", 2) AS "P25战力",
    round(r."P50战力", 2) AS "P50战力",
    round(r."P75战力", 2) AS "P75战力",
    round(r."P95战力", 2) AS "P95战力",
    CASE
        WHEN r."新增N天最高战力" > r."P95战力" THEN '是'
        ELSE '否'
    END AS "是否高于P95",
    round(
        r."新增N天最高战力" / nullif(r."P95战力", 0),
        2
    ) AS "P95倍数"

FROM
(
    SELECT
        t.*,

        count(*) OVER (
            PARTITION BY
                t."历史VIP",
                t."新增天数"
        ) AS "VIP样本人数",

        avg(t."新增N天最高战力") OVER (
            PARTITION BY
                t."历史VIP",
                t."新增天数"
        ) AS "VIP平均最高战力",

        min(t."新增N天最高战力") OVER (
            PARTITION BY
                t."历史VIP",
                t."新增天数"
        ) AS "P0战力",

        approx_percentile(
            t."新增N天最高战力",
            0.25
        ) OVER (
            PARTITION BY
                t."历史VIP",
                t."新增天数"
        ) AS "P25战力",

        approx_percentile(
            t."新增N天最高战力",
            0.50
        ) OVER (
            PARTITION BY
                t."历史VIP",
                t."新增天数"
        ) AS "P50战力",

        approx_percentile(
            t."新增N天最高战力",
            0.75
        ) OVER (
            PARTITION BY
                t."历史VIP",
                t."新增天数"
        ) AS "P75战力",

        approx_percentile(
            t."新增N天最高战力",
            0.95
        ) OVER (
            PARTITION BY
                t."历史VIP",
                t."新增天数"
        ) AS "P95战力"

    FROM
    (
        SELECT
            d.create_date AS "新增日期",
            cast(e."$part_date" AS date) AS "新增第N天日期",

            date_diff(
                'day',
                d.create_date,
                cast(e."$part_date" AS date)
            ) + 1 AS "新增天数",

            cast(coalesce(v.vip_level, 0) AS bigint) AS "历史VIP",
            d.user_id AS "用户ID",
            d.account_id AS "账号ID",
            d.nick_name AS "角色名",
            d.region_id AS "服务器ID",

            max(
                try_cast(e.after AS double)
            ) AS "新增N天最高战力",

            max_by(
                e."#event_time",
                try_cast(e.after AS double)
            ) AS "最高战力时间"

        FROM
        (
            SELECT
                u."#user_id" AS user_id,
                cast(u."#account_id" AS varchar) AS account_id,
                u.nick_name,
                u.region_id,
                date(u.create_role_time) AS create_date

            FROM
            (
                SELECT
                    "#user_id",
                    "#account_id",
                    nick_name,
                    region_id,
                    create_role_time,
                    cast(date(create_role_time) AS varchar) AS "$part_date"

                FROM ta.v_user_41

                WHERE create_role_time IS NOT NULL
            ) u

            WHERE u.${PartDate:date}
        ) d

        INNER JOIN ta.v_event_41 e

            ON cast(e."#account_id" AS varchar) = d.account_id

           AND cast(e."$part_date" AS date) >= d.create_date

           AND cast(e."$part_date" AS date)
               <= date_add(
                    'day',
                    -1,
                    current_date
                  )

        LEFT JOIN
        (
            SELECT
                "#long_id",
                "$tag_date",

                max(
                    coalesce(
                        tag_value_num,
                        0
                    )
                ) AS vip_level

            FROM ta.history_tag_41

            WHERE cluster_name = 'vip_level_today'

            GROUP BY
                "#long_id",
                "$tag_date"
        ) v

            ON d.user_id = v."#long_id"

           AND v."$tag_date" = cast(
                date_format(
                    cast(e."$part_date" AS date),
                    '%Y%m%d'
                ) AS integer
           )

        WHERE e."$part_event" = 'change_power_log'

          AND e.after IS NOT NULL

          AND (
                date_diff(
                    'day',
                    d.create_date,
                    cast(e."$part_date" AS date)
                ) + 1
              ) ${Number:number6}

        GROUP BY
            d.create_date,
            cast(e."$part_date" AS date),
            date_diff(
                'day',
                d.create_date,
                cast(e."$part_date" AS date)
            ) + 1,
            cast(coalesce(v.vip_level, 0) AS bigint),
            d.user_id,
            d.account_id,
            d.nick_name,
            d.region_id
    ) t

    WHERE t."新增N天最高战力" > 0
) r

ORDER BY
    r."历史VIP",
    r."新增天数",
    r."新增N天最高战力" DESC,
    r."账号ID"
