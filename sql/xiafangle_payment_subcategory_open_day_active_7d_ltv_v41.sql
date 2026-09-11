SELECT
    row_number() OVER (
        ORDER BY
            CASE
                WHEN x."LTV评估状态" = '可评估'
                 AND x."购买评估状态" = '可评估' THEN 0
                WHEN x."LTV评估状态" = '可评估' THEN 1
                ELSE 2
            END,
            x."开放后7日LTV贡献占比",
            x."开放后7日付费人数占比",
            x."一级分类",
            x."二级分类"
    ) "序号",

    x."一级分类",
    x."二级分类",
    x."小类配置商品数",
    x."最早付费天数",
    x."7日观察窗口",
    x."购买评估状态",
    x."LTV评估状态",

    x."开放日活跃人数",
    x."开放后7日付费人数",
    x."开放后7日总付费人数",
    x."开放后7日购买率",
    x."开放后7日付费人数占比",

    x."LTV成熟新增人数",
    x."成熟新增小类7日付费人数",
    x."成熟新增小类7日付费金额",
    x."开放后7日LTV贡献",
    x."对应成熟总付费金额",
    x."对应成熟总LTV",
    x."开放后7日LTV贡献占比",
    x."小类开放后7日ARPPU"

FROM
(
    SELECT
        r."product_type_one" "一级分类",
        r."product_type_two" "二级分类",
        r."小类配置商品数",

        CASE
            WHEN r."最早付费offset" IS NULL THEN NULL
            ELSE concat(
                'D',
                cast(r."最早付费offset" + 1 AS varchar)
            )
        END "最早付费天数",

        CASE
            WHEN r."最早付费offset" IS NULL THEN NULL
            ELSE concat(
                'D',
                cast(r."最早付费offset" + 1 AS varchar),
                '-D',
                cast(r."最早付费offset" + 7 AS varchar)
            )
        END "7日观察窗口",

        CASE
            WHEN r."最早付费offset" IS NULL THEN '无付费记录'
            WHEN r."开放日活跃人数" = 0 THEN '开放日无活跃玩家'
            ELSE '可评估'
        END "购买评估状态",

        CASE
            WHEN r."最早付费offset" IS NULL THEN '无付费记录'
            WHEN r."LTV成熟新增人数" = 0 THEN '对应区间未成熟'
            ELSE '可评估'
        END "LTV评估状态",

        r."开放日活跃人数",
        r."开放后7日付费人数",
        r."开放后7日总付费人数",

        CASE
            WHEN r."开放日活跃人数" = 0 THEN NULL
            ELSE round(
                r."开放后7日付费人数" * 1.0000
                / nullif(r."开放日活跃人数", 0),
                4
            )
        END "开放后7日购买率",

        CASE
            WHEN r."开放后7日总付费人数" = 0 THEN 0
            ELSE round(
                r."开放后7日付费人数" * 1.0000
                / nullif(r."开放后7日总付费人数", 0),
                4
            )
        END "开放后7日付费人数占比",

        r."LTV成熟新增人数",
        r."成熟新增小类7日付费人数",

        round(
            r."成熟新增小类7日付费金额",
            2
        ) "成熟新增小类7日付费金额",

        CASE
            WHEN r."LTV成熟新增人数" = 0 THEN NULL
            ELSE round(
                r."成熟新增小类7日付费金额" * 1.0000
                / nullif(r."LTV成熟新增人数", 0),
                4
            )
        END "开放后7日LTV贡献",

        round(
            r."对应成熟总付费金额",
            2
        ) "对应成熟总付费金额",

        CASE
            WHEN r."LTV成熟新增人数" = 0 THEN NULL
            ELSE round(
                r."对应成熟总付费金额" * 1.0000
                / nullif(r."LTV成熟新增人数", 0),
                4
            )
        END "对应成熟总LTV",

        CASE
            WHEN r."对应成熟总付费金额" = 0 THEN 0
            ELSE round(
                r."成熟新增小类7日付费金额" * 1.0000
                / nullif(r."对应成熟总付费金额", 0),
                4
            )
        END "开放后7日LTV贡献占比",

        CASE
            WHEN r."成熟新增小类7日付费人数" = 0 THEN NULL
            ELSE round(
                r."成熟新增小类7日付费金额" * 1.0000
                / nullif(r."成熟新增小类7日付费人数", 0),
                2
            )
        END "小类开放后7日ARPPU"

    FROM
    (
        SELECT
            m."product_type_one",
            m."product_type_two",
            max(m."小类配置商品数") "小类配置商品数",
            max(m."最早付费offset") "最早付费offset",

            coalesce(
                max(m."开放日活跃人数"),
                0
            ) "开放日活跃人数",

            coalesce(
                max(m."开放后7日付费人数"),
                0
            ) "开放后7日付费人数",

            coalesce(
                max(m."开放后7日总付费人数"),
                0
            ) "开放后7日总付费人数",

            coalesce(
                max(m."LTV成熟新增人数"),
                0
            ) "LTV成熟新增人数",

            coalesce(
                max(m."成熟新增小类7日付费人数"),
                0
            ) "成熟新增小类7日付费人数",

            coalesce(
                max(m."成熟新增小类7日付费金额"),
                0
            ) "成熟新增小类7日付费金额",

            coalesce(
                max(m."对应成熟总付费金额"),
                0
            ) "对应成熟总付费金额"

        FROM
        (
            /*==============================================================
              A. 开放日活跃口径：用于购买率、付费人数占比
            ==============================================================*/
            SELECT
                o."product_type_one",
                o."product_type_two",
                o."小类配置商品数",
                o."最早付费offset",

                count(
                    DISTINCT a."#account_id"
                ) "开放日活跃人数",

                count(
                    DISTINCT CASE
                        WHEN ecfg."product_type_one" = o."product_type_one"
                         AND ecfg."product_type_two" = o."product_type_two"
                            THEN a."#account_id"
                    END
                ) "开放后7日付费人数",

                count(
                    DISTINCT CASE
                        WHEN e."#account_id" IS NOT NULL
                            THEN a."#account_id"
                    END
                ) "开放后7日总付费人数",

                cast(NULL AS bigint) "LTV成熟新增人数",
                cast(NULL AS bigint) "成熟新增小类7日付费人数",
                cast(NULL AS double) "成熟新增小类7日付费金额",
                cast(NULL AS double) "对应成熟总付费金额"

            FROM
            (
                SELECT
                    cat."product_type_one",
                    cat."product_type_two",
                    cat."小类配置商品数",
                    min(p."pay_day") "最早付费offset"

                FROM
                (
                    SELECT
                        coalesce(
                            cast("product_type_one" AS varchar),
                            '未分类'
                        ) "product_type_one",

                        coalesce(
                            cast("product_type_two" AS varchar),
                            '未分类'
                        ) "product_type_two",

                        count(
                            DISTINCT concat(
                                cast(
                                    try_cast("product_id" AS bigint)
                                    AS varchar
                                ),
                                '_',
                                cast("product_name" AS varchar)
                            )
                        ) "小类配置商品数"

                    FROM ta_ext.product_id_name_41

                    WHERE "product_id" IS NOT NULL
                      AND "product_name" IS NOT NULL

                    GROUP BY
                        1,
                        2
                ) cat

                LEFT JOIN
                (
                    SELECT
                        cfg."product_type_one",
                        cfg."product_type_two",

                        date_diff(
                            'day',
                            c."create_date",
                            date(e."#event_time")
                        ) "pay_day"

                    FROM
                    (
                        SELECT DISTINCT
                            cast(
                                u."#account_id"
                                AS varchar
                            ) "#account_id",

                            date(
                                u."create_role_time"
                            ) "create_date"

                        FROM
                        (
                            SELECT
                                "#account_id",
                                "create_role_time",

                                cast(
                                    date("create_role_time")
                                    AS varchar
                                ) "$part_date"

                            FROM ta.v_user_41

                            WHERE "domain" = 'release'
                              AND "#account_id" IS NOT NULL
                              AND "create_role_time" IS NOT NULL
                        ) u

                        WHERE u.${PartDate:date}
                    ) c

                    INNER JOIN ta.v_event_41 e

                        ON cast(
                            e."#account_id"
                            AS varchar
                        ) = c."#account_id"

                       AND cast(
                            e."$part_date"
                            AS date
                       ) BETWEEN c."create_date"
                             AND current_date

                       AND date(e."#event_time")
                           BETWEEN c."create_date"
                               AND current_date

                    INNER JOIN
                    (
                        SELECT
                            try_cast(
                                "product_id"
                                AS bigint
                            ) "product_id",

                            cast(
                                "product_name"
                                AS varchar
                            ) "product_name",

                            coalesce(
                                max(
                                    cast(
                                        "product_type_one"
                                        AS varchar
                                    )
                                ),
                                '未分类'
                            ) "product_type_one",

                            coalesce(
                                max(
                                    cast(
                                        "product_type_two"
                                        AS varchar
                                    )
                                ),
                                '未分类'
                            ) "product_type_two"

                        FROM ta_ext.product_id_name_41

                        WHERE "product_id" IS NOT NULL
                          AND "product_name" IS NOT NULL

                        GROUP BY
                            1,
                            2
                    ) cfg

                        ON try_cast(
                            e."product_id"
                            AS bigint
                           ) = cfg."product_id"

                       AND cast(
                            e."product_name"
                            AS varchar
                           ) = cfg."product_name"

                    WHERE e."$part_event" = 'pay_log'
                      AND e."domain" = 'release'
                      AND e."#account_id" IS NOT NULL
                      AND e."$part_date" IS NOT NULL

                      AND CASE
                              WHEN coalesce(
                                       try_cast(
                                           e."payment"
                                           AS double
                                       ),
                                       0
                                   ) = 0
                                  THEN coalesce(
                                      try_cast(
                                          e."token_payment"
                                          AS double
                                      ),
                                      0
                                  )
                              ELSE coalesce(
                                  try_cast(
                                      e."payment"
                                      AS double
                                  ),
                                  0
                              )
                          END > 0

                      AND (
                            coalesce(
                                cast(
                                    e."product_type"
                                    AS varchar
                                ),
                                ''
                            ) <> '直充'

                            OR strpos(
                                coalesce(
                                    cast(
                                        e."product_name"
                                        AS varchar
                                    ),
                                    ''
                                ),
                                '钻石'
                            ) > 0
                          )
                ) p

                    ON p."product_type_one"
                        = cat."product_type_one"

                   AND p."product_type_two"
                        = cat."product_type_two"

                GROUP BY
                    1,
                    2,
                    3
            ) o

            LEFT JOIN
            (
                SELECT DISTINCT
                    c."#account_id",
                    c."create_date",

                    date_diff(
                        'day',
                        c."create_date",
                        date(ae."#event_time")
                    ) "active_offset"

                FROM
                (
                    SELECT DISTINCT
                        cast(
                            u."#account_id"
                            AS varchar
                        ) "#account_id",

                        date(
                            u."create_role_time"
                        ) "create_date"

                    FROM
                    (
                        SELECT
                            "#account_id",
                            "create_role_time",

                            cast(
                                date("create_role_time")
                                AS varchar
                            ) "$part_date"

                        FROM ta.v_user_41

                        WHERE "domain" = 'release'
                          AND "#account_id" IS NOT NULL
                          AND "create_role_time" IS NOT NULL
                    ) u

                    WHERE u.${PartDate:date}
                ) c

                INNER JOIN ta.v_event_41 ae

                    ON cast(
                        ae."#account_id"
                        AS varchar
                    ) = c."#account_id"

                   AND cast(
                        ae."$part_date"
                        AS date
                   ) BETWEEN c."create_date"
                         AND current_date

                   AND date(ae."#event_time")
                       BETWEEN c."create_date"
                           AND current_date

                WHERE ae."$part_event" = 'in_out_log'
                  AND ae."domain" = 'release'
                  AND ae."#account_id" IS NOT NULL
                  AND ae."$part_date" IS NOT NULL
            ) a

                ON o."最早付费offset" IS NOT NULL
               AND a."active_offset"
                    = o."最早付费offset"

            LEFT JOIN ta.v_event_41 e

                ON cast(
                    e."#account_id"
                    AS varchar
                ) = a."#account_id"

               AND cast(
                    e."$part_date"
                    AS date
               ) BETWEEN date_add(
                            'day',
                            o."最早付费offset",
                            a."create_date"
                         )
                   AND least(
                            date_add(
                                'day',
                                o."最早付费offset" + 6,
                                a."create_date"
                            ),
                            current_date
                       )

               AND date(e."#event_time")
                   BETWEEN date_add(
                                'day',
                                o."最早付费offset",
                                a."create_date"
                           )
                       AND least(
                                date_add(
                                    'day',
                                    o."最早付费offset" + 6,
                                    a."create_date"
                                ),
                                current_date
                           )

               AND e."$part_event" = 'pay_log'
               AND e."domain" = 'release'
               AND e."#account_id" IS NOT NULL
               AND e."$part_date" IS NOT NULL

               AND CASE
                       WHEN coalesce(
                                try_cast(
                                    e."payment"
                                    AS double
                                ),
                                0
                            ) = 0
                           THEN coalesce(
                               try_cast(
                                   e."token_payment"
                                   AS double
                               ),
                               0
                           )
                       ELSE coalesce(
                           try_cast(
                               e."payment"
                               AS double
                           ),
                           0
                       )
                   END > 0

               AND (
                    coalesce(
                        cast(
                            e."product_type"
                            AS varchar
                        ),
                        ''
                    ) <> '直充'

                    OR strpos(
                        coalesce(
                            cast(
                                e."product_name"
                                AS varchar
                            ),
                            ''
                        ),
                        '钻石'
                    ) > 0
                   )

            LEFT JOIN
            (
                SELECT
                    try_cast(
                        "product_id"
                        AS bigint
                    ) "product_id",

                    cast(
                        "product_name"
                        AS varchar
                    ) "product_name",

                    coalesce(
                        max(
                            cast(
                                "product_type_one"
                                AS varchar
                            )
                        ),
                        '未分类'
                    ) "product_type_one",

                    coalesce(
                        max(
                            cast(
                                "product_type_two"
                                AS varchar
                            )
                        ),
                        '未分类'
                    ) "product_type_two"

                FROM ta_ext.product_id_name_41

                WHERE "product_id" IS NOT NULL
                  AND "product_name" IS NOT NULL

                GROUP BY
                    1,
                    2
            ) ecfg

                ON try_cast(
                    e."product_id"
                    AS bigint
                   ) = ecfg."product_id"

               AND cast(
                    e."product_name"
                    AS varchar
                   ) = ecfg."product_name"

            GROUP BY
                1,
                2,
                3,
                4

            UNION ALL

            /*==============================================================
              B. 成熟新增口径：用于小类LTV贡献、总LTV、LTV贡献占比
              例：小类最早D15开放，观察D15-D21：
                  只取已经成熟到D21的新增玩家；
                  小类金额取D15-D21；
                  总LTV金额取同批玩家D1-D21全部有效付费。
            ==============================================================*/
            SELECT
                o."product_type_one",
                o."product_type_two",
                o."小类配置商品数",
                o."最早付费offset",

                cast(NULL AS bigint) "开放日活跃人数",
                cast(NULL AS bigint) "开放后7日付费人数",
                cast(NULL AS bigint) "开放后7日总付费人数",

                count(
                    DISTINCT c."#account_id"
                ) "LTV成熟新增人数",

                count(
                    DISTINCT CASE
                        WHEN ecfg."product_type_one" = o."product_type_one"
                         AND ecfg."product_type_two" = o."product_type_two"
                         AND date(e."#event_time")
                             BETWEEN date_add(
                                          'day',
                                          o."最早付费offset",
                                          c."create_date"
                                     )
                                 AND date_add(
                                          'day',
                                          o."最早付费offset" + 6,
                                          c."create_date"
                                     )
                            THEN c."#account_id"
                    END
                ) "成熟新增小类7日付费人数",

                sum(
                    CASE
                        WHEN ecfg."product_type_one" = o."product_type_one"
                         AND ecfg."product_type_two" = o."product_type_two"
                         AND date(e."#event_time")
                             BETWEEN date_add(
                                          'day',
                                          o."最早付费offset",
                                          c."create_date"
                                     )
                                 AND date_add(
                                          'day',
                                          o."最早付费offset" + 6,
                                          c."create_date"
                                     )
                            THEN
                                CASE
                                    WHEN coalesce(
                                             try_cast(
                                                 e."payment"
                                                 AS double
                                             ),
                                             0
                                         ) = 0
                                        THEN coalesce(
                                            try_cast(
                                                e."token_payment"
                                                AS double
                                            ),
                                            0
                                        )
                                    ELSE coalesce(
                                        try_cast(
                                            e."payment"
                                            AS double
                                        ),
                                        0
                                    )
                                END / 100.0000
                        ELSE 0
                    END
                ) "成熟新增小类7日付费金额",

                sum(
                    CASE
                        WHEN e."#account_id" IS NOT NULL
                            THEN
                                CASE
                                    WHEN coalesce(
                                             try_cast(
                                                 e."payment"
                                                 AS double
                                             ),
                                             0
                                         ) = 0
                                        THEN coalesce(
                                            try_cast(
                                                e."token_payment"
                                                AS double
                                            ),
                                            0
                                        )
                                    ELSE coalesce(
                                        try_cast(
                                            e."payment"
                                            AS double
                                        ),
                                        0
                                    )
                                END / 100.0000
                        ELSE 0
                    END
                ) "对应成熟总付费金额"

            FROM
            (
                SELECT
                    cat."product_type_one",
                    cat."product_type_two",
                    cat."小类配置商品数",
                    min(p."pay_day") "最早付费offset"

                FROM
                (
                    SELECT
                        coalesce(
                            cast("product_type_one" AS varchar),
                            '未分类'
                        ) "product_type_one",

                        coalesce(
                            cast("product_type_two" AS varchar),
                            '未分类'
                        ) "product_type_two",

                        count(
                            DISTINCT concat(
                                cast(
                                    try_cast("product_id" AS bigint)
                                    AS varchar
                                ),
                                '_',
                                cast("product_name" AS varchar)
                            )
                        ) "小类配置商品数"

                    FROM ta_ext.product_id_name_41

                    WHERE "product_id" IS NOT NULL
                      AND "product_name" IS NOT NULL

                    GROUP BY
                        1,
                        2
                ) cat

                LEFT JOIN
                (
                    SELECT
                        cfg."product_type_one",
                        cfg."product_type_two",

                        date_diff(
                            'day',
                            c."create_date",
                            date(e."#event_time")
                        ) "pay_day"

                    FROM
                    (
                        SELECT DISTINCT
                            cast(
                                u."#account_id"
                                AS varchar
                            ) "#account_id",

                            date(
                                u."create_role_time"
                            ) "create_date"

                        FROM
                        (
                            SELECT
                                "#account_id",
                                "create_role_time",

                                cast(
                                    date("create_role_time")
                                    AS varchar
                                ) "$part_date"

                            FROM ta.v_user_41

                            WHERE "domain" = 'release'
                              AND "#account_id" IS NOT NULL
                              AND "create_role_time" IS NOT NULL
                        ) u

                        WHERE u.${PartDate:date}
                    ) c

                    INNER JOIN ta.v_event_41 e

                        ON cast(
                            e."#account_id"
                            AS varchar
                        ) = c."#account_id"

                       AND cast(
                            e."$part_date"
                            AS date
                       ) BETWEEN c."create_date"
                             AND current_date

                       AND date(e."#event_time")
                           BETWEEN c."create_date"
                               AND current_date

                    INNER JOIN
                    (
                        SELECT
                            try_cast(
                                "product_id"
                                AS bigint
                            ) "product_id",

                            cast(
                                "product_name"
                                AS varchar
                            ) "product_name",

                            coalesce(
                                max(
                                    cast(
                                        "product_type_one"
                                        AS varchar
                                    )
                                ),
                                '未分类'
                            ) "product_type_one",

                            coalesce(
                                max(
                                    cast(
                                        "product_type_two"
                                        AS varchar
                                    )
                                ),
                                '未分类'
                            ) "product_type_two"

                        FROM ta_ext.product_id_name_41

                        WHERE "product_id" IS NOT NULL
                          AND "product_name" IS NOT NULL

                        GROUP BY
                            1,
                            2
                    ) cfg

                        ON try_cast(
                            e."product_id"
                            AS bigint
                           ) = cfg."product_id"

                       AND cast(
                            e."product_name"
                            AS varchar
                           ) = cfg."product_name"

                    WHERE e."$part_event" = 'pay_log'
                      AND e."domain" = 'release'
                      AND e."#account_id" IS NOT NULL
                      AND e."$part_date" IS NOT NULL

                      AND CASE
                              WHEN coalesce(
                                       try_cast(
                                           e."payment"
                                           AS double
                                       ),
                                       0
                                   ) = 0
                                  THEN coalesce(
                                      try_cast(
                                          e."token_payment"
                                          AS double
                                      ),
                                      0
                                  )
                              ELSE coalesce(
                                  try_cast(
                                      e."payment"
                                      AS double
                                  ),
                                  0
                              )
                          END > 0

                      AND (
                            coalesce(
                                cast(
                                    e."product_type"
                                    AS varchar
                                ),
                                ''
                            ) <> '直充'

                            OR strpos(
                                coalesce(
                                    cast(
                                        e."product_name"
                                        AS varchar
                                    ),
                                    ''
                                ),
                                '钻石'
                            ) > 0
                          )
                ) p

                    ON p."product_type_one"
                        = cat."product_type_one"

                   AND p."product_type_two"
                        = cat."product_type_two"

                GROUP BY
                    1,
                    2,
                    3
            ) o

            LEFT JOIN
            (
                SELECT DISTINCT
                    cast(
                        u."#account_id"
                        AS varchar
                    ) "#account_id",

                    date(
                        u."create_role_time"
                    ) "create_date"

                FROM
                (
                    SELECT
                        "#account_id",
                        "create_role_time",

                        cast(
                            date("create_role_time")
                            AS varchar
                        ) "$part_date"

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
                    o."最早付费offset" + 6,
                    c."create_date"
                   ) <= current_date

            LEFT JOIN ta.v_event_41 e

                ON cast(
                    e."#account_id"
                    AS varchar
                ) = c."#account_id"

               AND cast(
                    e."$part_date"
                    AS date
               ) BETWEEN c."create_date"
                   AND date_add(
                        'day',
                        o."最早付费offset" + 6,
                        c."create_date"
                   )

               AND date(e."#event_time")
                   BETWEEN c."create_date"
                       AND date_add(
                            'day',
                            o."最早付费offset" + 6,
                            c."create_date"
                       )

               AND e."$part_event" = 'pay_log'
               AND e."domain" = 'release'
               AND e."#account_id" IS NOT NULL
               AND e."$part_date" IS NOT NULL

               AND CASE
                       WHEN coalesce(
                                try_cast(
                                    e."payment"
                                    AS double
                                ),
                                0
                            ) = 0
                           THEN coalesce(
                               try_cast(
                                   e."token_payment"
                                   AS double
                               ),
                               0
                           )
                       ELSE coalesce(
                           try_cast(
                               e."payment"
                               AS double
                           ),
                           0
                       )
                   END > 0

               AND (
                    coalesce(
                        cast(
                            e."product_type"
                            AS varchar
                        ),
                        ''
                    ) <> '直充'

                    OR strpos(
                        coalesce(
                            cast(
                                e."product_name"
                                AS varchar
                            ),
                            ''
                        ),
                        '钻石'
                    ) > 0
                   )

            LEFT JOIN
            (
                SELECT
                    try_cast(
                        "product_id"
                        AS bigint
                    ) "product_id",

                    cast(
                        "product_name"
                        AS varchar
                    ) "product_name",

                    coalesce(
                        max(
                            cast(
                                "product_type_one"
                                AS varchar
                            )
                        ),
                        '未分类'
                    ) "product_type_one",

                    coalesce(
                        max(
                            cast(
                                "product_type_two"
                                AS varchar
                            )
                        ),
                        '未分类'
                    ) "product_type_two"

                FROM ta_ext.product_id_name_41

                WHERE "product_id" IS NOT NULL
                  AND "product_name" IS NOT NULL

                GROUP BY
                    1,
                    2
            ) ecfg

                ON try_cast(
                    e."product_id"
                    AS bigint
                   ) = ecfg."product_id"

               AND cast(
                    e."product_name"
                    AS varchar
                   ) = ecfg."product_name"

            GROUP BY
                1,
                2,
                3,
                4
        ) m

        GROUP BY
            1,
            2
    ) r
) x

ORDER BY
    CASE
        WHEN x."LTV评估状态" = '可评估'
         AND x."购买评估状态" = '可评估' THEN 0
        WHEN x."LTV评估状态" = '可评估' THEN 1
        ELSE 2
    END,
    x."开放后7日LTV贡献占比",
    x."开放后7日付费人数占比",
    x."一级分类",
    x."二级分类";