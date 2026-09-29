SELECT
    row_number() OVER (
        ORDER BY
            q."开服第N日",
            q."VIP分层"
    ) AS "序号",

    q."开服第N日",
    q."VIP分层",
    q."当日活跃人数",

    round(
        sum(q."累计获取") * 1.0000
        / nullif(q."当日活跃人数", 0),
        2
    ) AS "累计人均获取",

    round(
        sum(q."累计消耗") * 1.0000
        / nullif(q."当日活跃人数", 0),
        2
    ) AS "累计人均消耗"

FROM
(
    SELECT
        p."开服第N日",

        CASE
            WHEN p."VIP等级" BETWEEN 0 AND 3
                THEN 'a.V0-V3'
            WHEN p."VIP等级" BETWEEN 4 AND 6
                THEN 'b.V4-V6'
            WHEN p."VIP等级" BETWEEN 7 AND 9
                THEN 'c.V7-V9'
            ELSE 'd.V10+'
        END AS "VIP分层",

        count(*) OVER (
            PARTITION BY
                p."开服第N日",
                CASE
                    WHEN p."VIP等级" BETWEEN 0 AND 3
                        THEN 'a.V0-V3'
                    WHEN p."VIP等级" BETWEEN 4 AND 6
                        THEN 'b.V4-V6'
                    WHEN p."VIP等级" BETWEEN 7 AND 9
                        THEN 'c.V7-V9'
                    ELSE 'd.V10+'
                END
        ) AS "当日活跃人数",

        p."累计获取",
        p."累计消耗"

    FROM
    (
        SELECT
            a."#account_id",
            a."region_id",
            a."活跃日期",
            a."开服第N日",

            coalesce(
                a."VIP等级",
                0
            ) AS "VIP等级",

            coalesce(
                sum(r."获取数量"),
                0
            ) AS "累计获取",

            coalesce(
                sum(r."消耗数量"),
                0
            ) AS "累计消耗"

        FROM
        (
            SELECT
                d."#account_id",
                d."region_id",
                d."开服日期",
                d."活跃日期",
                d."开服第N日",

                coalesce(
                    max_by(
                        try_cast(v."after" AS bigint),
                        cast(v."#event_time" AS timestamp)
                    ),
                    0
                ) AS "VIP等级"

            FROM
            (
                SELECT DISTINCT
                    cast(
                        e."#account_id" AS varchar
                    ) AS "#account_id",

                    try_cast(
                        e."region_id" AS bigint
                    ) AS "region_id",

                    date(
                        u."server_open_time"
                    ) AS "开服日期",

                    date(
                        e."#event_time"
                    ) AS "活跃日期",

                    cast(
                        date_diff(
                            'day',
                            date(u."server_open_time"),
                            date(e."#event_time")
                        ) + 1
                        AS integer
                    ) AS "开服第N日"

                FROM ta.v_event_41 e

                INNER JOIN ta.v_user_41 u
                    ON cast(
                        e."#account_id" AS varchar
                    ) = cast(
                        u."#account_id" AS varchar
                    )

                   AND try_cast(
                        e."region_id" AS bigint
                    ) = try_cast(
                        u."region_id" AS bigint
                    )

                WHERE
                    e."$part_event" = 'in_out_log'

                    AND e."domain" = 'release'

                    AND u."domain" = 'release'

                    AND e."#account_id" IS NOT NULL

                    AND e."region_id" IS NOT NULL

                    AND u."server_open_time" IS NOT NULL

                    AND date_diff(
                        'day',
                        date(u."server_open_time"),
                        date(e."#event_time")
                    ) BETWEEN 0 AND 13
            ) d

            LEFT JOIN ta.v_event_41 v
                ON cast(
                    v."#account_id" AS varchar
                ) = d."#account_id"

               AND try_cast(
                    v."region_id" AS bigint
                ) = d."region_id"

               AND v."$part_event" = 'vip_change_log'

               AND v."domain" = 'release'

               AND cast(
                    v."#event_time" AS timestamp
                ) < date_add(
                    'day',
                    1,
                    cast(
                        d."活跃日期" AS timestamp
                    )
                )

            GROUP BY
                d."#account_id",
                d."region_id",
                d."开服日期",
                d."活跃日期",
                d."开服第N日"
        ) a

        LEFT JOIN
        (
            SELECT
                cast(
                    e."#account_id" AS varchar
                ) AS "#account_id",

                try_cast(
                    e."region_id" AS bigint
                ) AS "region_id",

                date(
                    e."#event_time"
                ) AS "资源日期",

                sum(
                    CASE
                        WHEN try_cast(
                            e."change_type" AS bigint
                        ) = 1
                        THEN coalesce(
                            try_cast(
                                e."item_num" AS double
                            ),
                            0
                        )

                        ELSE 0
                    END
                ) AS "获取数量",

                sum(
                    CASE
                        WHEN try_cast(
                            e."change_type" AS bigint
                        ) = 2
                        THEN coalesce(
                            try_cast(
                                e."item_num" AS double
                            ),
                            0
                        )

                        ELSE 0
                    END
                ) AS "消耗数量"

            FROM ta.v_event_41 e

            WHERE
                e."$part_event" = 'item_log'

                AND e."domain" = 'release'

                AND e."#account_id" IS NOT NULL

                AND try_cast(
                    e."region_id" AS bigint
                ) IS NOT NULL

                AND cast(
                    e."item_name" AS varchar
                ) = '远古精魄'

            GROUP BY
                cast(
                    e."#account_id" AS varchar
                ),

                try_cast(
                    e."region_id" AS bigint
                ),

                date(
                    e."#event_time"
                )
        ) r
            ON r."#account_id" = a."#account_id"

           AND r."region_id" = a."region_id"

           AND r."资源日期" BETWEEN
                a."开服日期"
                AND a."活跃日期"

        GROUP BY
            a."#account_id",
            a."region_id",
            a."活跃日期",
            a."开服第N日",
            a."VIP等级"
    ) p
) q

GROUP BY
    q."开服第N日",
    q."VIP分层",
    q."当日活跃人数"

ORDER BY
    q."开服第N日",
    q."VIP分层";