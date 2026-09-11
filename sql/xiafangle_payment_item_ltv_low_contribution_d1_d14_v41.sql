SELECT
    row_number() OVER (
        ORDER BY
            x.days,
            x."累计LTV贡献占比",
            x."累计付费人数占比",
            x."一级分类",
            x."二级分类",
            x."product_id",
            x."product_name"
    ) "序号",

    concat(
        'D',
        cast(x.days + 1 AS varchar)
    ) "新增第N天",

    x."成熟新增人数",
    x."一级分类",
    x."二级分类",
    x."付费项",
    x."product_id",
    x."product_name",
    round(x."配置单价", 2) "配置单价",

    x."累计付费人数",
    x."累计总付费人数",

    round(
        x."累计付费人数" * 1.0000
        / nullif(x."成熟新增人数", 0),
        4
    ) "累计购买率",

    x."累计付费人数占比",

    round(
        x."累计付费金额",
        2
    ) "累计付费金额",

    round(
        x."累计付费金额" * 1.0000
        / nullif(x."成熟新增人数", 0),
        4
    ) "累计LTV贡献",

    round(
        x."累计总付费金额" * 1.0000
        / nullif(x."成熟新增人数", 0),
        4
    ) "累计总LTV",

    x."累计LTV贡献占比",

    round(
        x."累计付费金额" * 1.0000
        / nullif(x."累计付费人数", 0),
        2
    ) "商品累计ARPPU"

FROM
(
    SELECT
        d.days,
        d."成熟新增人数",

        coalesce(
            cfg."product_type_one",
            '未分类'
        ) "一级分类",

        coalesce(
            cfg."product_type_two",
            '未分类'
        ) "二级分类",

        coalesce(
            cfg."product_id_name",
            concat(
                cast(cfg."product_id" AS varchar),
                '_',
                cfg."product_name"
            )
        ) "付费项",

        cfg."product_id",
        cfg."product_name",
        cfg."price" "配置单价",

        coalesce(
            p."累计付费人数",
            0
        ) "累计付费人数",

        coalesce(
            t."累计总付费人数",
            0
        ) "累计总付费人数",

        coalesce(
            round(
                coalesce(
                    p."累计付费人数",
                    0
                ) * 1.0000
                / nullif(
                    t."累计总付费人数",
                    0
                ),
                4
            ),
            0
        ) "累计付费人数占比",

        coalesce(
            p."累计付费金额",
            0
        ) "累计付费金额",

        coalesce(
            t."累计总付费金额",
            0
        ) "累计总付费金额",

        coalesce(
            round(
                coalesce(
                    p."累计付费金额",
                    0
                ) * 1.0000
                / nullif(
                    t."累计总付费金额",
                    0
                ),
                4
            ),
            0
        ) "累计LTV贡献占比"

    FROM
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

            max(
                cast(
                    "product_id_name"
                    AS varchar
                )
            ) "product_id_name",

            max(
                try_cast(
                    "price"
                    AS double
                )
            ) "price",

            max(
                cast(
                    "product_type_one"
                    AS varchar
                )
            ) "product_type_one",

            max(
                cast(
                    "product_type_two"
                    AS varchar
                )
            ) "product_type_two"

        FROM ta_ext.product_id_name_41

        WHERE "product_id" IS NOT NULL
          AND "product_name" IS NOT NULL

        GROUP BY
            1,
            2
    ) cfg

    CROSS JOIN
    (
        SELECT
            n.days,

            count(
                DISTINCT c."#account_id"
            ) "成熟新增人数"

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

        CROSS JOIN UNNEST(
            sequence(0, 13)
        ) AS n(days)

        WHERE date_add(
                  'day',
                  n.days,
                  c."create_date"
              )
              <= date_add(
                  'day',
                  -1,
                  current_date
              )

        GROUP BY
            1
    ) d

    LEFT JOIN
    (
        SELECT
            n.days,

            p."product_id",
            p."product_name",

            count(
                DISTINCT p."#account_id"
            ) "累计付费人数",

            sum(
                p."pay_amount"
            ) "累计付费金额"

        FROM
        (
            SELECT
                c."#account_id",
                c."create_date",

                date(
                    e."#event_time"
                ) "event_date",

                try_cast(
                    e."product_id"
                    AS bigint
                ) "product_id",

                cast(
                    e."product_name"
                    AS varchar
                ) "product_name",

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
                END / 100.0000 "pay_amount"

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

               AND date(
                    e."#event_time"
               ) BETWEEN c."create_date"
                     AND least(
                            date_add(
                                'day',
                                13,
                                c."create_date"
                            ),
                            date_add(
                                'day',
                                -1,
                                current_date
                            )
                         )

            WHERE e."$part_event" = 'pay_log'
              AND e."domain" = 'release'
              AND e."#account_id" IS NOT NULL
              AND e."$part_date" IS NOT NULL

              AND cast(
                    e."$part_date"
                    AS date
                  ) BETWEEN c."create_date"
                        AND least(
                               date_add(
                                   'day',
                                   13,
                                   c."create_date"
                               ),
                               date_add(
                                   'day',
                                   -1,
                                   current_date
                               )
                            )

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

        CROSS JOIN UNNEST(
            sequence(
                date_diff(
                    'day',
                    p."create_date",
                    p."event_date"
                ),
                13
            )
        ) AS n(days)

        WHERE date_add(
                  'day',
                  n.days,
                  p."create_date"
              )
              <= date_add(
                  'day',
                  -1,
                  current_date
              )

        GROUP BY
            1,
            2,
            3
    ) p

        ON p.days = d.days
       AND p."product_id" = cfg."product_id"
       AND p."product_name" = cfg."product_name"

    LEFT JOIN
    (
        SELECT
            n.days,

            count(
                DISTINCT p."#account_id"
            ) "累计总付费人数",

            sum(
                p."pay_amount"
            ) "累计总付费金额"

        FROM
        (
            SELECT
                c."#account_id",
                c."create_date",

                date(
                    e."#event_time"
                ) "event_date",

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
                END / 100.0000 "pay_amount"

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

               AND date(
                    e."#event_time"
               ) BETWEEN c."create_date"
                     AND least(
                            date_add(
                                'day',
                                13,
                                c."create_date"
                            ),
                            date_add(
                                'day',
                                -1,
                                current_date
                            )
                         )

            WHERE e."$part_event" = 'pay_log'
              AND e."domain" = 'release'
              AND e."#account_id" IS NOT NULL
              AND e."$part_date" IS NOT NULL

              AND cast(
                    e."$part_date"
                    AS date
                  ) BETWEEN c."create_date"
                        AND least(
                               date_add(
                                   'day',
                                   13,
                                   c."create_date"
                               ),
                               date_add(
                                   'day',
                                   -1,
                                   current_date
                               )
                            )

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

        CROSS JOIN UNNEST(
            sequence(
                date_diff(
                    'day',
                    p."create_date",
                    p."event_date"
                ),
                13
            )
        ) AS n(days)

        WHERE date_add(
                  'day',
                  n.days,
                  p."create_date"
              )
              <= date_add(
                  'day',
                  -1,
                  current_date
              )

        GROUP BY
            1
    ) t

        ON t.days = d.days
) x

ORDER BY
    x.days,
    x."累计LTV贡献占比",
    x."累计付费人数占比",
    x."一级分类",
    x."二级分类",
    x."product_id",
    x."product_name";
