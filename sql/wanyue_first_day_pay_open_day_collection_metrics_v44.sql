SELECT
    row_number() OVER (
        ORDER BY
            t."分层排序",
            t."开服天数"
    ) AS "序号",

    t."首日付费分层",
    t."开服天数",
    t."藏品人均抽取数",
    t."七日目标第六天付费率",
    t."藏品计划付费率",
    t."限时礼包藏品付费率",
    t."藏品升级礼包",
    t."藏品搜寻礼包",
    t."藏品福利礼包",
    t."高级搜寻礼包"

FROM
(
    SELECT
        x."首日付费分层",
        x."分层排序",
        x."开服天数",

        cast(
            round(
                sum(x."藏品抽取数") * 1.0000
                /
                nullif(
                    count(
                        DISTINCT CASE
                            WHEN x."藏品抽取数" > 0
                                THEN x."#account_id"
                        END
                    ),
                    0
                ),
                2
            ) AS decimal(18, 2)
        ) AS "藏品人均抽取数",

        cast(
            round(
                count(
                    DISTINCT CASE
                        WHEN x.p823 = 1
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
        ) AS "七日目标第六天付费率",

        cast(
            round(
                count(
                    DISTINCT CASE
                        WHEN x.p_collection_plan = 1
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
        ) AS "藏品计划付费率",

        cast(
            round(
                count(
                    DISTINCT CASE
                        WHEN x.p_collection_limited = 1
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
        ) AS "限时礼包藏品付费率",

        cast(
            round(
                count(
                    DISTINCT CASE
                        WHEN x.p108 = 1
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
        ) AS "藏品升级礼包",

        cast(
            round(
                count(
                    DISTINCT CASE
                        WHEN x.p111 = 1
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
        ) AS "藏品搜寻礼包",

        cast(
            round(
                count(
                    DISTINCT CASE
                        WHEN x.p257 = 1
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
        ) AS "藏品福利礼包",

        cast(
            round(
                count(
                    DISTINCT CASE
                        WHEN x.p260 = 1
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
        ) AS "高级搜寻礼包"

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

            coalesce(
                a.collection_gacha_num,
                0
            ) AS "藏品抽取数",

            CASE
                WHEN p.p823_date
                     BETWEEN c.create_date
                         AND a.event_date
                    THEN 1
                ELSE 0
            END AS p823,

            CASE
                WHEN p.p_collection_plan_date
                     BETWEEN c.create_date
                         AND a.event_date
                    THEN 1
                ELSE 0
            END AS p_collection_plan,

            CASE
                WHEN p.p_collection_limited_date
                     BETWEEN c.create_date
                         AND a.event_date
                    THEN 1
                ELSE 0
            END AS p_collection_limited,

            CASE
                WHEN p.p108_date
                     BETWEEN c.create_date
                         AND a.event_date
                    THEN 1
                ELSE 0
            END AS p108,

            CASE
                WHEN p.p111_date
                     BETWEEN c.create_date
                         AND a.event_date
                    THEN 1
                ELSE 0
            END AS p111,

            CASE
                WHEN p.p257_date
                     BETWEEN c.create_date
                         AND a.event_date
                    THEN 1
                ELSE 0
            END AS p257,

            CASE
                WHEN p.p260_date
                     BETWEEN c.create_date
                         AND a.event_date
                    THEN 1
                ELSE 0
            END AS p260

        FROM
        (
            SELECT
                u.create_date,
                u.server_open_date,
                u."#account_id",

                CASE
                    WHEN coalesce(fp.first_day_pay, 0) = 0
                        THEN 'a_free'
                    WHEN coalesce(fp.first_day_pay, 0) <= 6
                        THEN 'b_(0,6]'
                    WHEN coalesce(fp.first_day_pay, 0) <= 30
                        THEN 'c_(6,30]'
                    WHEN coalesce(fp.first_day_pay, 0) <= 100
                        THEN 'd_(30,100]'
                    WHEN coalesce(fp.first_day_pay, 0) <= 300
                        THEN 'e_(100,300]'
                    WHEN coalesce(fp.first_day_pay, 0) <= 500
                        THEN 'f_(300,500]'
                    WHEN coalesce(fp.first_day_pay, 0) <= 1000
                        THEN 'g_(500,1000]'
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
                                    cast(
                                        v."create_role_time"
                                        AS varchar
                                    )
                                    AS timestamp
                                )
                            ),
                            date(
                                from_unixtime(
                                    try_cast(
                                        cast(
                                            v."create_role_time"
                                            AS varchar
                                        )
                                        AS double
                                    )
                                )
                            )
                        ) AS create_date,

                        coalesce(
                            date(
                                try_cast(
                                    cast(
                                        v."server_open_time"
                                        AS varchar
                                    )
                                    AS timestamp
                                )
                            ),
                            date(
                                from_unixtime(
                                    try_cast(
                                        cast(
                                            v."server_open_time"
                                            AS varchar
                                        )
                                        AS double
                                    )
                                )
                            )
                        ) AS server_open_date,

                        cast(
                            coalesce(
                                date(
                                    try_cast(
                                        cast(
                                            v."create_role_time"
                                            AS varchar
                                        )
                                        AS timestamp
                                    )
                                ),
                                date(
                                    from_unixtime(
                                        try_cast(
                                            cast(
                                                v."create_role_time"
                                                AS varchar
                                            )
                                            AS double
                                        )
                                    )
                                )
                            )
                            AS varchar
                        ) AS "$part_date",

                        cast(
                            v."#account_id"
                            AS varchar
                        ) AS "#account_id"

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
                    cast(
                        pay_e."#account_id"
                        AS varchar
                    ) AS "#account_id",

                    date(
                        pay_e."#event_time"
                    ) AS pay_date,

                    sum(
                        coalesce(
                            try_cast(
                                pay_e."payment"
                                AS double
                            ),
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
                                        cast(
                                            v1."create_role_time"
                                            AS varchar
                                        )
                                        AS timestamp
                                    )
                                ),
                                date(
                                    from_unixtime(
                                        try_cast(
                                            cast(
                                                v1."create_role_time"
                                                AS varchar
                                            )
                                            AS double
                                        )
                                    )
                                )
                            ) AS create_date,

                            cast(
                                coalesce(
                                    date(
                                        try_cast(
                                            cast(
                                                v1."create_role_time"
                                                AS varchar
                                            )
                                            AS timestamp
                                        )
                                    ),
                                    date(
                                        from_unixtime(
                                            try_cast(
                                                cast(
                                                    v1."create_role_time"
                                                    AS varchar
                                                )
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
                  AND pay_e."$part_date" IS NOT NULL

                  AND coalesce(
                        try_cast(
                            pay_e."payment"
                            AS double
                        ),
                        0
                      ) > 0

                  AND date(pay_e."$part_date")
                      BETWEEN pay_range.min_create_date
                          AND pay_range.max_create_date

                  AND date(pay_e."#event_time")
                      BETWEEN pay_range.min_create_date
                          AND pay_range.max_create_date

                GROUP BY
                    cast(
                        pay_e."#account_id"
                        AS varchar
                    ),
                    date(
                        pay_e."#event_time"
                    )
            ) fp
                ON u."#account_id" = fp."#account_id"
               AND u.create_date = fp.pay_date
        ) c

        INNER JOIN
        (
            SELECT
                cast(
                    e."#account_id"
                    AS varchar
                ) AS "#account_id",

                date(
                    e."#event_time"
                ) AS event_date,

                max(
                    CASE
                        WHEN e."$part_event" = 'in_out_log'
                            THEN 1
                        ELSE 0
                    END
                ) AS is_active,

                sum(
                    CASE
                        WHEN e."$part_event" = 'gacha_log'

                         AND lower(
                                trim(
                                    cast(
                                        e."pool_type"
                                        AS varchar
                                    )
                                )
                             ) = 'collection'

                            THEN coalesce(
                                cardinality(
                                    e."award_ting"
                                ),
                                0
                            )
                        ELSE 0
                    END
                ) AS collection_gacha_num

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
                                    cast(
                                        v2."create_role_time"
                                        AS varchar
                                    )
                                    AS timestamp
                                )
                            ),
                            date(
                                from_unixtime(
                                    try_cast(
                                        cast(
                                            v2."create_role_time"
                                            AS varchar
                                        )
                                        AS double
                                    )
                                )
                            )
                        ) AS create_date,

                        cast(
                            coalesce(
                                date(
                                    try_cast(
                                        cast(
                                            v2."create_role_time"
                                            AS varchar
                                        )
                                        AS timestamp
                                    )
                                ),
                                date(
                                    from_unixtime(
                                        try_cast(
                                            cast(
                                                v2."create_role_time"
                                                AS varchar
                                            )
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
                    'gacha_log'
                  )

              AND e."#account_id" IS NOT NULL
              AND e."$part_date" IS NOT NULL

              AND date(e."$part_date")
                  BETWEEN event_range.min_create_date
                      AND date_add(
                            'day',
                            -1,
                            current_date
                          )

              AND date(e."#event_time")
                  BETWEEN event_range.min_create_date
                      AND date_add(
                            'day',
                            -1,
                            current_date
                          )

            GROUP BY
                cast(
                    e."#account_id"
                    AS varchar
                ),
                date(
                    e."#event_time"
                )
        ) a
            ON c."#account_id" = a."#account_id"
           AND a.is_active = 1
           AND a.event_date >= c.create_date

        LEFT JOIN
        (
            SELECT
                cast(
                    p."#account_id"
                    AS varchar
                ) AS "#account_id",

                min(
                    CASE
                        WHEN try_cast(
                                trim(
                                    cast(
                                        p."product_id"
                                        AS varchar
                                    )
                                )
                                AS double
                             ) = 823
                            THEN date(p."#event_time")
                    END
                ) AS p823_date,

                min(
                    CASE
                        WHEN try_cast(
                                trim(
                                    cast(
                                        p."product_id"
                                        AS varchar
                                    )
                                )
                                AS double
                             ) IN (
                                901,
                                902,
                                903,
                                904,
                                905,
                                906,
                                907
                             )
                            THEN date(p."#event_time")
                    END
                ) AS p_collection_plan_date,

                min(
                    CASE
                        WHEN try_cast(
                                trim(
                                    cast(
                                        p."product_id"
                                        AS varchar
                                    )
                                )
                                AS double
                             ) IN (
                                40004,
                                40005,
                                40006
                             )
                            THEN date(p."#event_time")
                    END
                ) AS p_collection_limited_date,

                min(
                    CASE
                        WHEN try_cast(
                                trim(
                                    cast(
                                        p."product_id"
                                        AS varchar
                                    )
                                )
                                AS double
                             ) = 108
                            THEN date(p."#event_time")
                    END
                ) AS p108_date,

                min(
                    CASE
                        WHEN try_cast(
                                trim(
                                    cast(
                                        p."product_id"
                                        AS varchar
                                    )
                                )
                                AS double
                             ) = 111
                            THEN date(p."#event_time")
                    END
                ) AS p111_date,

                min(
                    CASE
                        WHEN try_cast(
                                trim(
                                    cast(
                                        p."product_id"
                                        AS varchar
                                    )
                                )
                                AS double
                             ) = 257
                            THEN date(p."#event_time")
                    END
                ) AS p257_date,

                min(
                    CASE
                        WHEN try_cast(
                                trim(
                                    cast(
                                        p."product_id"
                                        AS varchar
                                    )
                                )
                                AS double
                             ) = 260
                            THEN date(p."#event_time")
                    END
                ) AS p260_date

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
                                    cast(
                                        v3."create_role_time"
                                        AS varchar
                                    )
                                    AS timestamp
                                )
                            ),
                            date(
                                from_unixtime(
                                    try_cast(
                                        cast(
                                            v3."create_role_time"
                                            AS varchar
                                        )
                                        AS double
                                    )
                                )
                            )
                        ) AS create_date,

                        cast(
                            coalesce(
                                date(
                                    try_cast(
                                        cast(
                                            v3."create_role_time"
                                            AS varchar
                                        )
                                        AS timestamp
                                    )
                                ),
                                date(
                                    from_unixtime(
                                        try_cast(
                                            cast(
                                                v3."create_role_time"
                                                AS varchar
                                            )
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
              AND p."$part_date" IS NOT NULL

              AND coalesce(
                    try_cast(
                        p."payment"
                        AS double
                    ),
                    0
                  ) > 0

              AND try_cast(
                    trim(
                        cast(
                            p."product_id"
                            AS varchar
                        )
                    )
                    AS double
                  ) IN (
                    823,
                    901,
                    902,
                    903,
                    904,
                    905,
                    906,
                    907,
                    40004,
                    40005,
                    40006,
                    108,
                    111,
                    257,
                    260
                  )

              AND date(p."$part_date")
                  BETWEEN pay_range.min_create_date
                      AND date_add(
                            'day',
                            -1,
                            current_date
                          )

              AND date(p."#event_time")
                  BETWEEN pay_range.min_create_date
                      AND date_add(
                            'day',
                            -1,
                            current_date
                          )

            GROUP BY
                cast(
                    p."#account_id"
                    AS varchar
                )
        ) p
            ON c."#account_id" = p."#account_id"

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