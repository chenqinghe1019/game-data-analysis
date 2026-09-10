SELECT
    row_number() OVER (
        ORDER BY
            x."create_date",
            x.days,
            x."累计付费金额" DESC,
            x."product_id",
            x."product_name"
    ) "序号",

    x."create_date" "新增日期",

    concat(
        'D',
        cast(x.days + 1 AS varchar)
    ) "新增第N天",

    x."成熟新增人数",

    coalesce(
        x."product_id_name",
        concat(
            cast(x."product_id" AS varchar),
            '_',
            x."product_name"
        )
    ) "付费项",

    x."product_id",
    x."product_name",
    round(x."price", 2) "配置单价",
    x."product_type_one" "一级分类",
    x."product_type_two" "二级分类",

    x."当日付费人数",
    round(x."当日付费金额", 2) "当日付费金额",

    round(
        x."当日付费金额" * 1.0000
        / nullif(x."成熟新增人数", 0),
        4
    ) "当日LTV贡献",

    round(
        x."当日总付费金额" * 1.0000
        / nullif(x."成熟新增人数", 0),
        4
    ) "当日总LTV",

    coalesce(
        round(
            x."当日付费金额" * 1.0000
            / nullif(x."当日总付费金额", 0),
            4
        ),
        0
    ) "当日LTV贡献占比",

    x."累计付费人数",
    round(x."累计付费金额", 2) "累计付费金额",

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

    coalesce(
        round(
            x."累计付费金额" * 1.0000
            / nullif(x."累计总付费金额", 0),
            4
        ),
        0
    ) "累计LTV贡献占比"

FROM
(
    SELECT
        g.*,

        max(
            CASE
                WHEN g."是否汇总" = 1
                    THEN g."分组人数"
            END
        ) OVER (
            PARTITION BY
                g."create_date",
                g.days
        ) "成熟新增人数",

        max(
            CASE
                WHEN g."是否汇总" = 1
                    THEN g."当日付费金额"
            END
        ) OVER (
            PARTITION BY
                g."create_date",
                g.days
        ) "当日总付费金额",

        max(
            CASE
                WHEN g."是否汇总" = 1
                    THEN g."累计付费金额"
            END
        ) OVER (
            PARTITION BY
                g."create_date",
                g.days
        ) "累计总付费金额"

    FROM
    (
        SELECT
            ud."create_date",
            ud.days,

            grouping(
                p."product_id"
            ) "是否汇总",

            p."product_id_name",
            p."product_id",
            p."product_name",
            p."price",
            p."product_type_one",
            p."product_type_two",

            count(
                DISTINCT ud."#account_id"
            ) "分组人数",

            count(
                DISTINCT CASE
                    WHEN p."event_date" = ud."target_date"
                     AND p."pay_amount" > 0
                        THEN ud."#account_id"
                END
            ) "当日付费人数",

            sum(
                CASE
                    WHEN p."event_date" = ud."target_date"
                        THEN coalesce(
                            p."pay_amount",
                            0
                        )
                    ELSE 0
                END
            ) "当日付费金额",

            count(
                DISTINCT CASE
                    WHEN p."pay_amount" > 0
                        THEN ud."#account_id"
                END
            ) "累计付费人数",

            sum(
                coalesce(
                    p."pay_amount",
                    0
                )
            ) "累计付费金额"

        FROM
        (
            SELECT
                c."#account_id",
                c."create_date",
                n.days,

                date_add(
                    'day',
                    n.days,
                    c."create_date"
                ) "target_date"

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
                sequence(0, 29)
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
        ) ud

        LEFT JOIN
        (
            SELECT
                c."#account_id",
                c."create_date",

                date(
                    e."#event_time"
                ) "event_date",

                cfg."product_id_name",
                cfg."product_id",
                cfg."product_name",
                cfg."price",
                cfg."product_type_one",
                cfg."product_type_two",

                sum(
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
                    END
                ) / 100.0000 "pay_amount"

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
               )
                   BETWEEN c."create_date"
                       AND least(
                            date_add(
                                'day',
                                29,
                                c."create_date"
                            ),
                            date_add(
                                'day',
                                -1,
                                current_date
                            )
                       )

               AND date(
                    e."#event_time"
               )
                   BETWEEN c."create_date"
                       AND least(
                            date_add(
                                'day',
                                29,
                                c."create_date"
                            ),
                            date_add(
                                'day',
                                -1,
                                current_date
                            )
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

            GROUP BY
                1,
                2,
                3,
                4,
                5,
                6,
                7,
                8,
                9
        ) p

            ON p."#account_id"
                = ud."#account_id"

           AND p."create_date"
                = ud."create_date"

           AND p."event_date"
                BETWEEN ud."create_date"
                    AND ud."target_date"

        GROUP BY GROUPING SETS
        (
            (
                ud."create_date",
                ud.days,
                p."product_id_name",
                p."product_id",
                p."product_name",
                p."price",
                p."product_type_one",
                p."product_type_two"
            ),
            (
                ud."create_date",
                ud.days
            )
        )
    ) g
) x

WHERE x."是否汇总" = 0
  AND x."product_id" IS NOT NULL

ORDER BY
    x."create_date",
    x.days,
    x."累计付费金额" DESC,
    x."product_id",
    x."product_name";
