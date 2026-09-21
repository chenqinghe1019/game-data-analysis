SELECT
    row_number() OVER (
        ORDER BY
            r."历史VIP",
            r."新增天数",
            r."新增N天战力" DESC
    ) AS "序号",
    r."新增天数",
    r."历史VIP",
    r."账号ID",
    r."角色名",
    r."服务器ID",
    round(r."新增N天战力", 2) AS "战力",
    round(r."P99战力", 2) AS "P99战力",
    round(r."P99战力" * 3, 2) AS "异常阈值",
    round(
        r."新增N天战力" / nullif(r."P99战力", 0),
        2
    ) AS "P99倍数"

FROM
(
    SELECT
        t.*,

        approx_percentile(
            t."新增N天战力",
            0.99
        ) OVER (
            PARTITION BY
                t."历史VIP",
                t."新增天数"
        ) AS "P99战力"

    FROM
    (
        SELECT
            q."新增天数",
            q."历史VIP",
            q."账号ID",
            q."角色名",
            q."服务器ID",
            q."新增N天战力"

        FROM
        (
            SELECT
                d.create_date,
                a.active_date AS target_date,

                date_diff(
                    'day',
                    d.create_date,
                    a.active_date
                ) + 1 AS "新增天数",

                cast(
                    coalesce(v.vip_level, 0) AS bigint
                ) AS "历史VIP",

                d.account_id AS "账号ID",
                d.nick_name AS "角色名",
                d.region_id AS "服务器ID",

                max_by(
                    p.power_value,
                    p.event_time
                ) AS "新增N天战力"

            FROM
            (
                SELECT
                    u."#user_id" AS user_id,
                    cast(
                        u."#account_id" AS varchar
                    ) AS account_id,
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
                        cast(
                            date(create_role_time) AS varchar
                        ) AS "$part_date"

                    FROM ta.v_user_41

                    WHERE create_role_time IS NOT NULL
                ) u

                WHERE u.${PartDate:date}
            ) d

            INNER JOIN
            (
                SELECT
                    cast(
                        "#account_id" AS varchar
                    ) AS account_id,

                    cast(
                        "$part_date" AS date
                    ) AS active_date

                FROM ta.v_event_41

                WHERE "$part_event" = 'in_out_log'
                  AND "$part_date" IS NOT NULL

                GROUP BY
                    cast("#account_id" AS varchar),
                    cast("$part_date" AS date)
            ) a

                ON a.account_id = d.account_id

               AND a.active_date >= d.create_date

               AND a.active_date
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
                        a.active_date,
                        '%Y%m%d'
                    ) AS integer
               )

            INNER JOIN
            (
                SELECT
                    cast(
                        "#account_id" AS varchar
                    ) AS account_id,

                    cast(
                        "$part_date" AS date
                    ) AS event_date,

                    "#event_time" AS event_time,

                    try_cast(
                        after AS double
                    ) AS power_value

                FROM ta.v_event_41

                WHERE "$part_event" = 'change_power_log'
                  AND "$part_date" IS NOT NULL
                  AND after IS NOT NULL
            ) p

                ON p.account_id = d.account_id

               AND p.event_date >= d.create_date

               AND p.event_date <= a.active_date

            WHERE (
                    date_diff(
                        'day',
                        d.create_date,
                        a.active_date
                    ) + 1
                  ) ${Number:number6}

            GROUP BY
                d.create_date,
                a.active_date,

                date_diff(
                    'day',
                    d.create_date,
                    a.active_date
                ) + 1,

                cast(
                    coalesce(v.vip_level, 0) AS bigint
                ),

                d.account_id,
                d.nick_name,
                d.region_id
        ) q

        INNER JOIN
        (
            SELECT
                cast(
                    "#account_id" AS varchar
                ) AS account_id,

                cast(
                    "$part_date" AS date
                ) AS event_date,

                try_cast(
                    map_id AS bigint
                ) AS map_id

            FROM ta.v_event_41

            WHERE "$part_event" IN (
                    'battle_star',
                    'battle_result'
                  )

              AND "$part_date" IS NOT NULL

              AND try_cast(
                    battle_type AS bigint
                  ) = 1
        ) b

            ON b.account_id = q."账号ID"

           AND b.event_date >= q.create_date

           AND b.event_date <= q.target_date

        WHERE q."新增N天战力" > 0

        GROUP BY
            q."新增天数",
            q."历史VIP",
            q."账号ID",
            q."角色名",
            q."服务器ID",
            q."新增N天战力"

        HAVING max(b.map_id) > 3
    ) t
) r

WHERE r."新增N天战力" > r."P99战力" * 3

ORDER BY
    r."历史VIP",
    r."新增天数",
    r."新增N天战力" DESC
