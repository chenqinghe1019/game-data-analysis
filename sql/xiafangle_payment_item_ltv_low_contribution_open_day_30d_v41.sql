SELECT
    row_number() OVER (
        ORDER BY
            CASE
                WHEN x."评估状态" = '可评估' THEN 0
                WHEN x."评估状态" = '无付费记录' THEN 1
                ELSE 2
            END,
            x."开放后30日LTV贡献占比",
            x."开放后30日付费人数占比",
            x."一级分类",
            x."二级分类",
            x."product_id",
            x."product_name"
    ) "序号",

    x."一级分类",
    x."二级分类",
    x."付费项",
    x."product_id",
    x."product_name",
    round(x."配置单价", 2) "配置单价",

    CASE
        WHEN x."最早付费offset" IS NULL THEN NULL
        ELSE concat(
            'D',
            cast(x."最早付费offset" + 1 AS varchar)
        )
    END "最早付费天数",

    CASE
        WHEN x."最早付费offset" IS NULL THEN NULL
        ELSE concat(
            'D',
            cast(x."最早付费offset" + 1 AS varchar),
            '-D',
            cast(x."最早付费offset" + 30 AS varchar)
        )
    END "30日观察窗口",

    x."评估状态",
    x."成熟新增人数",

    CASE
        WHEN x."评估状态" <> '可评估' THEN NULL
        ELSE x."开放后30日付费人数"
    END "开放后30日付费人数",

    CASE
        WHEN x."评估状态" <> '可评估' THEN NULL
        ELSE x."开放后30日总付费人数"
    END "开放后30日总付费人数",

    CASE
        WHEN x."评估状态" <> '可评估' THEN NULL
        ELSE round(
            x."开放后30日付费人数" * 1.0000
            / nullif(x."成熟新增人数", 0),
            4
        )
    END "开放后30日购买率",

    CASE
        WHEN x."评估状态" <> '可评估' THEN NULL
        ELSE coalesce(
            round(
                x."开放后30日付费人数" * 1.0000
                / nullif(x."开放后30日总付费人数", 0),
                4
            ),
            0
        )
    END "开放后30日付费人数占比",

    CASE
        WHEN x."评估状态" <> '可评估' THEN NULL
        ELSE round(x."开放后30日付费金额", 2)
    END "开放后30日付费金额",

    CASE
        WHEN x."评估状态" <> '可评估' THEN NULL
        ELSE round(
            x."开放后30日付费金额" * 1.0000
            / nullif(x."成熟新增人数", 0),
            4
        )
    END "开放后30日LTV贡献",

    CASE
        WHEN x."评估状态" <> '可评估' THEN NULL
        ELSE round(
            x."开放后30日总付费金额" * 1.0000
            / nullif(x."成熟新增人数", 0),
            4
        )
    END "开放后30日总LTV",

    CASE
        WHEN x."评估状态" <> '可评估' THEN NULL
        ELSE coalesce(
            round(
                x."开放后30日付费金额" * 1.0000
                / nullif(x."开放后30日总付费金额", 0),
                4
            ),
            0
        )
    END "开放后30日LTV贡献占比",

    CASE
        WHEN x."评估状态" <> '可评估' THEN NULL
        ELSE round(
            x."开放后30日付费金额" * 1.0000
            / nullif(x."开放后30日付费人数", 0),
            2
        )
    END "商品开放后30日ARPPU"

FROM
(
    SELECT
        y.*,

        CASE
            WHEN y."最早付费offset" IS NULL THEN '无付费记录'
            WHEN y."成熟新增人数" = 0 THEN '观察窗口未成熟'
            ELSE '可评估'
        END "评估状态"

    FROM
    (
        SELECT
            o."product_type_one" "一级分类",
            o."product_type_two" "二级分类",
            o."product_id_name" "付费项",
            o."product_id",
            o."product_name",
            o."price" "配置单价",
            o."最早付费offset",

            count(
                DISTINCT c."#account_id"
            ) "成熟新增人数",

            count(
                DISTINCT CASE
                    WHEN try_cast(e."product_id" AS bigint) = o."product_id"
                     AND cast(e."product_name" AS varchar) = o."product_name"
                        THEN c."#account_id"
                END
            ) "开放后30日付费人数",

            count(
                DISTINCT CASE
                    WHEN e."#account_id" IS NOT NULL
                        THEN c."#account_id"
                END
            ) "开放后30日总付费人数",

            sum(
                CASE
                    WHEN try_cast(e."product_id" AS bigint) = o."product_id"
                     AND cast(e."product_name" AS varchar) = o."product_name"
                        THEN CASE
                                WHEN coalesce(
                                         try_cast(e."payment" AS double),
                                         0
                                     ) = 0
                                    THEN coalesce(
                                        try_cast(e."token_payment" AS double),
                                        0
                                    )
                                ELSE coalesce(
                                    try_cast(e."payment" AS double),
                                    0
                                )
                             END / 100.0000
                    ELSE 0
                END
            ) "开放后30日付费金额",

            sum(
                CASE
                    WHEN e."#account_id" IS NOT NULL
                        THEN CASE
                                WHEN coalesce(
                                         try_cast(e."payment" AS double),
                                         0
                                     ) = 0
                                    THEN coalesce(
                                        try_cast(e."token_payment" AS double),
                                        0
                                    )
                                ELSE coalesce(
                                    try_cast(e."payment" AS double),
                                    0
                                )
                             END / 100.0000
                    ELSE 0
                END
            ) "开放后30日总付费金额"

        FROM
        (
            SELECT
                cfg."product_id",
                cfg."product_name",
                cfg."product_id_name",
                cfg."price",
                cfg."product_type_one",
                cfg."product_type_two",

                min(p."pay_day") "最早付费offset"

            FROM
            (
                SELECT
                    try_cast("product_id" AS bigint) "product_id",
                    cast("product_name" AS varchar) "product_name",
                    max(cast("product_id_name" AS varchar)) "product_id_name",
                    max(try_cast("price" AS double)) "price",
                    coalesce(
                        max(cast("product_type_one" AS varchar)),
                        '未分类'
                    ) "product_type_one",
                    coalesce(
                        max(cast("product_type_two" AS varchar)),
                        '未分类'
                    ) "product_type_two"

                FROM ta_ext.product_id_name_41

                WHERE "product_id" IS NOT NULL
                  AND "product_name" IS NOT NULL

                GROUP BY
                    1,
                    2
            ) cfg

            LEFT JOIN
            (
                SELECT
                    try_cast(e."product_id" AS bigint) "product_id",
                    cast(e."product_name" AS varchar) "product_name",

                    date_diff(
                        'day',
                        c."create_date",
                        date(e."#event_time")
                    ) "pay_day"

                FROM
                (
                    SELECT DISTINCT
                        cast(u."#account_id" AS varchar) "#account_id",
                        date(u."create_role_time") "create_date"

                    FROM
                    (
                        SELECT
                            "#account_id",
                            "create_role_time",
                            cast(date("create_role_time") AS varchar) "$part_date"

                        FROM ta.v_user_41

                        WHERE "domain" = 'release'
                          AND "#account_id" IS NOT NULL
                          AND "create_role_time" IS NOT NULL
                    ) u

                    WHERE u.${PartDate:date}
                ) c

                INNER JOIN ta.v_event_41 e

                    ON cast(e."#account_id" AS varchar) = c."#account_id"

                   AND cast(e."$part_date" AS date)
                       BETWEEN c."create_date"
                           AND date_add(
                                'day',
                                -1,
                                current_date
                           )

                   AND date(e."#event_time")
                       BETWEEN c."create_date"
                           AND date_add(
                                'day',
                                -1,
                                current_date
                           )

                WHERE e."$part_event" = 'pay_log'
                  AND e."domain" = 'release'
                  AND e."#account_id" IS NOT NULL
                  AND e."$part_date" IS NOT NULL

                  AND CASE
                          WHEN coalesce(
                                   try_cast(e."payment" AS double),
                                   0
                               ) = 0
                              THEN coalesce(
                                  try_cast(e."token_payment" AS double),
                                  0
                              )
                          ELSE coalesce(
                              try_cast(e."payment" AS double),
                              0
                          )
                      END > 0

                  AND (
                        coalesce(
                            cast(e."product_type" AS varchar),
                            ''
                        ) <> '直充'

                        OR strpos(
                            coalesce(
                                cast(e."product_name" AS varchar),
                                ''
                            ),
                            '钻石'
                        ) > 0
                      )
            ) p

                ON p."product_id" = cfg."product_id"
               AND p."product_name" = cfg."product_name"

            GROUP BY
                1,
                2,
                3,
                4,
                5,
                6
        ) o

        LEFT JOIN
        (
            SELECT DISTINCT
                cast(u."#account_id" AS varchar) "#account_id",
                date(u."create_role_time") "create_date"

            FROM
            (
                SELECT
                    "#account_id",
                    "create_role_time",
                    cast(date("create_role_time") AS varchar) "$part_date"

                FROM ta.v_user_41

                WHERE "domain" = 'release'
                  AND "#account_id" IS NOT NULL
                  AND "create_role_time" IS NOT NULL
            ) u

            WHERE u.${PartDate:date}
        ) c

            ON o."最早付费offset" IS NOT NULL

           AND date_add(
                'day',
                o."最早付费offset" + 29,
                c."create_date"
               )
               <= date_add(
                    'day',
                    -1,
                    current_date
                  )

        LEFT JOIN ta.v_event_41 e

            ON cast(e."#account_id" AS varchar) = c."#account_id"

           AND cast(e."$part_date" AS date)
               BETWEEN date_add(
                            'day',
                            o."最早付费offset",
                            c."create_date"
                       )
                   AND date_add(
                            'day',
                            o."最早付费offset" + 29,
                            c."create_date"
                       )

           AND date(e."#event_time")
               BETWEEN date_add(
                            'day',
                            o."最早付费offset",
                            c."create_date"
                       )
                   AND date_add(
                            'day',
                            o."最早付费offset" + 29,
                            c."create_date"
                       )

           AND e."$part_event" = 'pay_log'
           AND e."domain" = 'release'
           AND e."#account_id" IS NOT NULL
           AND e."$part_date" IS NOT NULL

           AND CASE
                   WHEN coalesce(
                            try_cast(e."payment" AS double),
                            0
                        ) = 0
                       THEN coalesce(
                           try_cast(e."token_payment" AS double),
                           0
                       )
                   ELSE coalesce(
                       try_cast(e."payment" AS double),
                       0
                   )
               END > 0

           AND (
                coalesce(
                    cast(e."product_type" AS varchar),
                    ''
                ) <> '直充'

                OR strpos(
                    coalesce(
                        cast(e."product_name" AS varchar),
                        ''
                    ),
                    '钻石'
                ) > 0
               )

        GROUP BY
            1,
            2,
            3,
            4,
            5,
            6,
            7
    ) y
) x

ORDER BY
    CASE
        WHEN x."评估状态" = '可评估' THEN 0
        WHEN x."评估状态" = '无付费记录' THEN 1
        ELSE 2
    END,
    x."开放后30日LTV贡献占比",
    x."开放后30日付费人数占比",
    x."一级分类",
    x."二级分类",
    x."product_id",
    x."product_name";
