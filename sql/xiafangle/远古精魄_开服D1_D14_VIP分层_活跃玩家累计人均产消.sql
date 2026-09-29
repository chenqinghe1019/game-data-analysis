SELECT
    row_number() OVER (
        ORDER BY
            q."开服第N日",
            q."VIP分层"
    ) AS "序号",

    q."开服第N日",
    q."VIP分层",
    count(*) AS "当日活跃人数",

    round(
        avg(
            cast(
                q."累计获取" AS double
            )
        ),
        2
    ) AS "累计人均获取",

    round(
        avg(
            cast(
                q."累计消耗" AS double
            )
        ),
        2
    ) AS "累计人均消耗",

    round(
        avg(
            cast(
                q."截至当日剩余" AS double
            )
        ),
        2
    ) AS "截至当日人均剩余"

FROM
(
    SELECT
        p."#account_id",
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

        p."累计获取",
        p."累计消耗",
        p."截至当日剩余"

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
            ) AS "累计消耗",

            coalesce(
                max_by(
                    r."当日结余",
                    r."资源日期"
                ),
                0
            ) AS "截至当日剩余"

        FROM
        (
            SELECT
                d."#account_id",
                d."region_id",
                d."开服日期",
                d."活跃日期",
                d."开服第N日",

                coalesce(
                    max(
                        try_cast(
                            v."after" AS bigint
                        )
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

                INNER JOIN
                (
                    SELECT
                        u0."#account_id",
                        u0."region_id",
                        u0."server_open_time"

                    FROM
                    (
                        SELECT
                            "#account_id",
                            "region_id",
                            "server_open_time",

                            cast(
                                date("server_open_time")
                                AS varchar
                            ) AS "$part_date"

                        FROM ta.v_user_41

                        WHERE
                            "domain" = 'release'

                            AND "server_open_time" IS NOT NULL
                    ) u0

                    WHERE
                        u0.${PartDate:date}
                ) u
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
                    e."$part_date" >= '2023-10-01'

                    AND e."$part_date"
                        <= cast(
                            current_date AS varchar
                        )

                    AND e."$part_event" = 'in_out_log'

                    AND e."domain" = 'release'

                    AND e."#account_id" IS NOT NULL

                    AND e."region_id" IS NOT NULL

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

               AND v."$part_date" >= '2023-10-01'

               AND v."$part_date"
                    <= cast(
                        d."活跃日期" AS varchar
                    )

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
                ) AS "消耗数量",

                max_by(
                    try_cast(
                        e."item_result" AS double
                    ),
                    cast(
                        e."#event_time" AS timestamp
                    )
                ) AS "当日结余"

            FROM ta.v_event_41 e

            WHERE
                e."$part_date" >= '2023-10-01'

                AND e."$part_date"
                    <= cast(
                        current_date AS varchar
                    )

                AND e."$part_event" = 'item_log'

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
    q."VIP分层"

ORDER BY
    q."开服第N日",
    q."VIP分层";