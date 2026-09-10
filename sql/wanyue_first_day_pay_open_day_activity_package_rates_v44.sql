SELECT
    row_number() OVER (
        ORDER BY
            t."分层排序",
            t."开服天数"
    ) AS "序号",
    t."首日付费分层",
    t."开服天数",
    t."星际参与率",
    t."星际人均参与次数",
    t."星际巡航战令付费率",
    t."七日目标第五天付费礼包",
    t."商城专武大礼包",
    t."高级专武礼包",
    t."专武福利礼包"
FROM
(
    SELECT
        x."首日付费分层",
        x."分层排序",
        x."开服天数",

        cast(
            round(
                count(
                    DISTINCT CASE
                        WHEN x."星际参与次数" > 0
                            THEN x."#account_id"
                    END
                ) * 1.0000
                /
                nullif(
                    count(DISTINCT x."#account_id"),
                    0
                ),
                4
            ) AS decimal(18, 4)
        ) AS "星际参与率",

        cast(
            round(
                sum(x."星际参与次数") * 1.0000
                /
                nullif(
                    count(
                        DISTINCT CASE
                            WHEN x."星际参与次数" > 0
                                THEN x."#account_id"
                        END
                    ),
                    0
                ),
                2
            ) AS decimal(18, 2)
        ) AS "星际人均参与次数",

        cast(
            round(
                count(
                    DISTINCT CASE
                        WHEN x.p40 = 1
                            THEN x."#account_id"
                    END
                ) * 1.0000
                /
                nullif(
                    count(DISTINCT x."#account_id"),
                    0
                ),
                4
            ) AS decimal(18, 4)
        ) AS "星际巡航战令付费率",

        cast(
            round(
                count(
                    DISTINCT CASE
                        WHEN x.p819 = 1
                            THEN x."#account_id"
                    END
                ) * 1.0000
                /
                nullif(
                    count(DISTINCT x."#account_id"),
                    0
                ),
                4
            ) AS decimal(18, 4)
        ) AS "七日目标第五天付费礼包",

        cast(
            round(
                count(
                    DISTINCT CASE
                        WHEN x.p113 = 1
                            THEN x."#account_id"
                    END
                ) * 1.0000
                /
                nullif(
                    count(DISTINCT x."#account_id"),
                    0
                ),
                4
            ) AS decimal(18, 4)
        ) AS "商城专武大礼包",

        cast(
            round(
                count(
                    DISTINCT CASE
                        WHEN x.p263 = 1
                            THEN x."#account_id"
                    END
                ) * 1.0000
                /
                nullif(
                    count(DISTINCT x."#account_id"),
                    0
                ),
                4
            ) AS decimal(18, 4)
        ) AS "高级专武礼包",

        cast(
            round(
                count(
                    DISTINCT CASE
                        WHEN x.p256 = 1
                            THEN x."#account_id"
                    END
                ) * 1.0000
                /
                nullif(
                    count(DISTINCT x."#account_id"),
                    0
                ),
                4
            ) AS decimal(18, 4)
        ) AS "专武福利礼包"

    FROM
    (
        SELECT
            a."#account_id",
            c."首日付费分层",
            c."分层排序",

            date_diff(
                'day',
                c.server_open_date,
                a.event_date
            ) + 1 AS "开服天数",

            coalesce(a.star_count, 0) AS "星际参与次数",
            coalesce(p.p40, 0) AS p40,
            coalesce(p.p819, 0) AS p819,
            coalesce(p.p113, 0) AS p113,
            coalesce(p.p263, 0) AS p263,
            coalesce(p.p256, 0) AS p256

        FROM
        (
            SELECT
                u.create_date,
                u.server_open_date,
                u."#account_id",

                CASE
                    WHEN coalesce(fp.first_day_pay, 0) = 0 THEN 'a_free'
                    WHEN coalesce(fp.first_day_pay, 0) <= 6 THEN 'b_(0,6]'
                    WHEN coalesce(fp.first_day_pay, 0) <= 30 THEN 'c_(6,30]'
                    WHEN coalesce(fp.first_day_pay, 0) <= 100 THEN 'd_(30,100]'
                    WHEN coalesce(fp.first_day_pay, 0) <= 300 THEN 'e_(100,300]'
                    WHEN coalesce(fp.first_day_pay, 0) <= 500 THEN 'f_(300,500]'
                    WHEN coalesce(fp.first_day_pay, 0) <= 1000 THEN 'g_(500,1000]'
                    ELSE 'h_(1000,+)'
                END AS "首日付费分层",

                CASE
                    WHEN coalesce(fp.first_day_pay, 0) = 0 THEN 1
                    WHEN coalesce(fp.first_day_pay, 0) <= 6 THEN 2
                    WHEN coalesce(fp.first_day_pay, 0) <= 30 THEN 3
                    WHEN coalesce(fp.first_day_pay, 0) <= 100 THEN 4
                    WHEN coalesce(fp.first_day_pay, 0) <= 300 THEN 5
                    WHEN coalesce(fp.first_day_pay, 0) <= 500 THEN 6
                    WHEN coalesce(fp.first_day_pay, 0) <= 1000 THEN 7
                    ELSE 8
                END AS "分层排序"

            FROM
            (
                SELECT DISTINCT
                    user_raw.create_date,
                    user_raw.server_open_date,
                    user_raw."$part_date",
                    user_raw."#account_id"

                FROM
                (
                    SELECT
                        coalesce(
                            date(
                                try_cast(
                                    cast(v."create_role_time" AS varchar)
                                    AS timestamp
                                )
                            ),
                            date(
                                from_unixtime(
                                    try_cast(
                                        cast(v."create_role_time" AS varchar)
                                        AS double
                                    )
                                )
                            )
                        ) AS create_date,

                        coalesce(
                            date(
                                try_cast(
                                    cast(v."server_open_time" AS varchar)
                                    AS timestamp
                                )
                            ),
                            date(
                                from_unixtime(
                                    try_cast(
                                        cast(v."server_open_time" AS varchar)
                                        AS double
                                    )
                                )
                            )
                        ) AS server_open_date,

                        cast(
                            coalesce(
                                date(
                                    try_cast(
                                        cast(v."create_role_time" AS varchar)
                                        AS timestamp
                                    )
                                ),
                                date(
                                    from_unixtime(
                                        try_cast(
                                            cast(v."create_role_time" AS varchar)
                                            AS double
                                        )
                                    )
                                )
                            )
                            AS varchar
                        ) AS "$part_date",

                        cast(v."#account_id" AS varchar) AS "#account_id"

                    FROM ta.v_user_44 v

                    WHERE v."domain" = 'release'
                      AND v."#account_id" IS NOT NULL
                      AND v."create_role_time" IS NOT NULL
                      AND v."server_open_time" IS NOT NULL
                ) user_raw

                WHERE user_raw.create_date IS NOT NULL
                  AND user_raw.server_open_date IS NOT NULL
                  AND user_raw.create_date < current_date
                  AND user_raw.${PartDate:date}
            ) u

            LEFT JOIN
            (
                SELECT
                    cast(pay_e."#account_id" AS varchar) AS "#account_id",
                    date(pay_e."#event_time") AS pay_date,

                    sum(
                        coalesce(
                            try_cast(pay_e."payment" AS double),
                            0
                        )
                    ) / 100.0000 AS first_day_pay

                FROM ta.v_event_44 pay_e

                CROSS JOIN
                (
                    SELECT
                        min(range_raw.create_date) AS min_create_date,
                        max(range_raw.create_date) AS max_create_date

                    FROM
                    (
                        SELECT
                            coalesce(
                                date(
                                    try_cast(
                                        cast(v1."create_role_time" AS varchar)
                                        AS timestamp
                                    )
                                ),
                                date(
                                    from_unixtime(
                                        try_cast(
                                            cast(v1."create_role_time" AS varchar)
                                            AS double
                                        )
                                    )
                                )
                            ) AS create_date,

                            cast(
                                coalesce(
                                    date(
                                        try_cast(
                                            cast(v1."create_role_time" AS varchar)
                                            AS timestamp
                                        )
                                    ),
                                    date(
                                        from_unixtime(
                                            try_cast(
                                                cast(v1."create_role_time" AS varchar)
                                                AS double
                                            )
                                        )
                                    )
                                )
                                AS varchar
                            ) AS "$part_date"

                        FROM ta.v_user_44 v1

                        WHERE v1."domain" = 'release'
                          AND v1."#account_id" IS NOT NULL
                          AND v1."create_role_time" IS NOT NULL
                    ) range_raw

                    WHERE range_raw.create_date IS NOT NULL
                      AND range_raw.create_date < current_date
                      AND range_raw.${PartDate:date}
                ) pay_range

                WHERE pay_e."$part_event" = 'pay_log'
                  AND pay_e."#account_id" IS NOT NULL
                  AND coalesce(
                        try_cast(pay_e."payment" AS double),
                        0
                      ) > 0
                  AND date(pay_e."$part_date")
                      BETWEEN pay_range.min_create_date
                          AND pay_range.max_create_date
                  AND date(pay_e."#event_time")
                      BETWEEN pay_range.min_create_date
                          AND pay_range.max_create_date

                GROUP BY
                    cast(pay_e."#account_id" AS varchar),
                    date(pay_e."#event_time")
            ) fp
                ON u."#account_id" = fp."#account_id"
               AND u.create_date = fp.pay_date
        ) c

        INNER JOIN
        (
            SELECT
                cast(e."#account_id" AS varchar) AS "#account_id",
                date(e."#event_time") AS event_date,

                count(
                    DISTINCT CASE
                        WHEN e."$part_event" = 'battle_result'
                         AND try_cast(
                                cast(e."battle_type" AS varchar)
                                AS double
                             ) = 37
                            THEN coalesce(
                                nullif(
                                    trim(
                                        cast(e."battle_uid" AS varchar)
                                    ),
                                    ''
                                ),
                                cast(e."#event_time" AS varchar)
                            )
                    END
                ) AS star_count,

                max(
                    CASE
                        WHEN e."$part_event" = 'in_out_log'
                            THEN 1
                        ELSE 0
                    END
                ) AS is_active

            FROM ta.v_event_44 e

            CROSS JOIN
            (
                SELECT
                    min(range_raw.create_date) AS min_create_date

                FROM
                (
                    SELECT
                        coalesce(
                            date(
                                try_cast(
                                    cast(v2."create_role_time" AS varchar)
                                    AS timestamp
                                )
                            ),
                            date(
                                from_unixtime(
                                    try_cast(
                                        cast(v2."create_role_time" AS varchar)
                                        AS double
                                    )
                                )
                            )
                        ) AS create_date,

                        cast(
                            coalesce(
                                date(
                                    try_cast(
                                        cast(v2."create_role_time" AS varchar)
                                        AS timestamp
                                    )
                                ),
                                date(
                                    from_unixtime(
                                        try_cast(
                                            cast(v2."create_role_time" AS varchar)
                                            AS double
                                        )
                                    )
                                )
                            )
                            AS varchar
                        ) AS "$part_date"

                    FROM ta.v_user_44 v2

                    WHERE v2."domain" = 'release'
                      AND v2."#account_id" IS NOT NULL
                      AND v2."create_role_time" IS NOT NULL
                ) range_raw

                WHERE range_raw.create_date IS NOT NULL
                  AND range_raw.create_date < current_date
                  AND range_raw.${PartDate:date}
            ) event_range

            WHERE e."$part_event" IN (
                    'in_out_log',
                    'battle_result'
                  )
              AND e."#account_id" IS NOT NULL
              AND date(e."$part_date")
                  BETWEEN event_range.min_create_date
                      AND date_add('day', -1, current_date)
              AND date(e."#event_time")
                  BETWEEN event_range.min_create_date
                      AND date_add('day', -1, current_date)

            GROUP BY
                cast(e."#account_id" AS varchar),
                date(e."#event_time")
        ) a
            ON c."#account_id" = a."#account_id"
           AND a.is_active = 1
           AND a.event_date >= c.create_date

        LEFT JOIN
        (
            SELECT
                cast(p."#account_id" AS varchar) AS "#account_id",
                date(p."#event_time") AS pay_date,

                max(
                    CASE
                        WHEN try_cast(
                                cast(p."product_id" AS varchar)
                                AS double
                             ) = 40
                            THEN 1
                        ELSE 0
                    END
                ) AS p40,

                max(
                    CASE
                        WHEN try_cast(
                                cast(p."product_id" AS varchar)
                                AS double
                             ) = 819
                            THEN 1
                        ELSE 0
                    END
                ) AS p819,

                max(
                    CASE
                        WHEN try_cast(
                                cast(p."product_id" AS varchar)
                                AS double
                             ) = 113
                            THEN 1
                        ELSE 0
                    END
                ) AS p113,

                max(
                    CASE
                        WHEN try_cast(
                                cast(p."product_id" AS varchar)
                                AS double
                             ) = 263
                            THEN 1
                        ELSE 0
                    END
                ) AS p263,

                max(
                    CASE
                        WHEN try_cast(
                                cast(p."product_id" AS varchar)
                                AS double
                             ) = 256
                            THEN 1
                        ELSE 0
                    END
                ) AS p256

            FROM ta.v_event_44 p

            CROSS JOIN
            (
                SELECT
                    min(range_raw.create_date) AS min_create_date

                FROM
                (
                    SELECT
                        coalesce(
                            date(
                                try_cast(
                                    cast(v3."create_role_time" AS varchar)
                                    AS timestamp
                                )
                            ),
                            date(
                                from_unixtime(
                                    try_cast(
                                        cast(v3."create_role_time" AS varchar)
                                        AS double
                                    )
                                )
                            )
                        ) AS create_date,

                        cast(
                            coalesce(
                                date(
                                    try_cast(
                                        cast(v3."create_role_time" AS varchar)
                                        AS timestamp
                                    )
                                ),
                                date(
                                    from_unixtime(
                                        try_cast(
                                            cast(v3."create_role_time" AS varchar)
                                            AS double
                                        )
                                    )
                                )
                            )
                            AS varchar
                        ) AS "$part_date"

                    FROM ta.v_user_44 v3

                    WHERE v3."domain" = 'release'
                      AND v3."#account_id" IS NOT NULL
                      AND v3."create_role_time" IS NOT NULL
                ) range_raw

                WHERE range_raw.create_date IS NOT NULL
                  AND range_raw.create_date < current_date
                  AND range_raw.${PartDate:date}
            ) pay_range

            WHERE p."$part_event" = 'pay_log'
              AND p."#account_id" IS NOT NULL
              AND coalesce(
                    try_cast(p."payment" AS double),
                    0
                  ) > 0
              AND try_cast(
                    cast(p."product_id" AS varchar)
                    AS double
                  ) IN (
                    40,
                    819,
                    113,
                    263,
                    256
                  )
              AND date(p."$part_date")
                  BETWEEN pay_range.min_create_date
                      AND date_add('day', -1, current_date)
              AND date(p."#event_time")
                  BETWEEN pay_range.min_create_date
                      AND date_add('day', -1, current_date)

            GROUP BY
                cast(p."#account_id" AS varchar),
                date(p."#event_time")
        ) p
            ON a."#account_id" = p."#account_id"
           AND a.event_date = p.pay_date

        WHERE date_diff(
                'day',
                c.server_open_date,
                a.event_date
              ) + 1 >= 1
    ) x

    GROUP BY
        x."首日付费分层",
        x."分层排序",
        x."开服天数"
) t

ORDER BY
    t."分层排序",
    t."开服天数";