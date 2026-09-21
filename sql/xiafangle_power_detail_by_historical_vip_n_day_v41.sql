SELECT
    row_number() OVER (
        ORDER BY
            r."历史VIP",
            r."新增天数",
            r."新增N天最高战力" DESC
    ) AS "序号",
    r."新增天数",
    r."历史VIP",
    r."账号ID",
    r."角色名",
    r."服务器ID",
    round(r."新增N天最高战力", 2) AS "最高战力",
    round(r."P99战力", 2) AS "P99战力",
    round(r."P99战力" * 3, 2) AS "异常阈值",
    round(
        r."新增N天最高战力" / nullif(r."P99战力", 0),
        2
    ) AS "P99倍数"

FROM
(
    SELECT
        t.*,

        approx_percentile(
            t."新增N天最高战力",
            0.99
        ) OVER (
            PARTITION BY
                t."历史VIP",
                t."新增天数"
        ) AS "P99战力"

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
            d.account_id AS "账号ID",
            d.nick_name AS "角色名",
            d.region_id AS "服务器ID",

            max(
                try_cast(e.after AS double)
            ) AS "新增N天最高战力"

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

        INNER JOIN ta.v_event_41 b

            ON cast(b."#account_id" AS varchar) = d.account_id

           AND b."$part_event" IN (
                'battle_star',
                'battle_result'
           )

           AND try_cast(b.battle_type AS bigint) = 1

           AND cast(b."$part_date" AS date) >= d.create_date

           AND cast(b."$part_date" AS date)
               <= cast(e."$part_date" AS date)

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
            d.account_id,
            d.nick_name,
            d.region_id

        HAVING max(
            try_cast(b.map_id AS bigint)
        ) > 3
    ) t

    WHERE t."新增N天最高战力" > 0
) r

WHERE r."新增N天最高战力" > r."P99战力" * 3

ORDER BY
    r."历史VIP",
    r."新增天数",
    r."新增N天最高战力" DESC
