SELECT
    row_number() OVER (
        ORDER BY
            x."前30日LTV贡献占比",
            x."前30日付费人数占比",
            x."一级分类",
            x."二级分类",
            x."product_id",
            x."product_name"
    ) "序号",

    x."成熟新增人数",
    x."一级分类",
    x."二级分类",
    x."付费项",
    x."product_id",
    x."product_name",
    round(x."配置单价", 2) "配置单价",

    x."前30日付费人数",
    x."前30日总付费人数",

    round(
        x."前30日付费人数" * 1.0000
        / nullif(x."成熟新增人数", 0),
        4
    ) "前30日购买率",

    x."前30日付费人数占比",

    round(x."前30日付费金额", 2) "前30日付费金额",

    round(
        x."前30日付费金额" * 1.0000
        / nullif(x."成熟新增人数", 0),
        4
    ) "前30日LTV贡献",

    round(
        x."前30日总付费金额" * 1.0000
        / nullif(x."成熟新增人数", 0),
        4
    ) "前30日总LTV",

    x."前30日LTV贡献占比",

    round(
        x."前30日付费金额" * 1.0000
        / nullif(x."前30日付费人数", 0),
        2
    ) "商品前30日ARPPU"

FROM
(
    SELECT
        d."成熟新增人数",

        coalesce(cfg."product_type_one", '未分类') "一级分类",
        coalesce(cfg."product_type_two", '未分类') "二级分类",

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

        coalesce(s."前30日付费人数", 0) "前30日付费人数",
        coalesce(s."前30日总付费人数", 0) "前30日总付费人数",

        coalesce(
            round(
                coalesce(s."前30日付费人数", 0) * 1.0000
                / nullif(s."前30日总付费人数", 0),
                4
            ),
            0
        ) "前30日付费人数占比",

        coalesce(s."前30日付费金额", 0) "前30日付费金额",
        coalesce(s."前30日总付费金额", 0) "前30日总付费金额",

        coalesce(
            round(
                coalesce(s."前30日付费金额", 0) * 1.0000
                / nullif(s."前30日总付费金额", 0),
                4
            ),
            0
        ) "前30日LTV贡献占比"

    FROM
    (
        SELECT
            try_cast("product_id" AS bigint) "product_id",
            cast("product_name" AS varchar) "product_name",
            max(cast("product_id_name" AS varchar)) "product_id_name",
            max(try_cast("price" AS double)) "price",
            max(cast("product_type_one" AS varchar)) "product_type_one",
            max(cast("product_type_two" AS varchar)) "product_type_two"

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
            count(DISTINCT c."#account_id") "成熟新增人数"

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

        WHERE date_add('day', 29, c."create_date")
              <= date_add('day', -1, current_date)
    ) d

    LEFT JOIN
    (
        SELECT
            z."product_id",
            z."product_name",
            z."前30日付费人数",
            z."前30日付费金额",
            z."前30日总付费人数",
            z."前30日总付费金额"

        FROM
        (
            SELECT
                g.*,

                max(
                    CASE
                        WHEN g."是否汇总" = 3
                            THEN g."前30日付费人数"
                    END
                ) OVER () "前30日总付费人数",

                max(
                    CASE
                        WHEN g."是否汇总" = 3
                            THEN g."前30日付费金额"
                    END
                ) OVER () "前30日总付费金额"

            FROM
            (
                SELECT
                    grouping(
                        p."product_id",
                        p."product_name"
                    ) "是否汇总",

                    p."product_id",
                    p."product_name",

                    count(
                        DISTINCT p."#account_id"
                    ) "前30日付费人数",

                    sum(
                        p."pay_amount"
                    ) "前30日付费金额"

                FROM
                (
                    SELECT
                        c."#account_id",

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

                       AND cast(
                            e."$part_date"
                            AS date
                       ) BETWEEN c."create_date"
                           AND date_add(
                                'day',
                                29,
                                c."create_date"
                           )

                       AND date(
                            e."#event_time"
                       ) BETWEEN c."create_date"
                           AND date_add(
                                'day',
                                29,
                                c."create_date"
                           )

                    WHERE date_add(
                              'day',
                              29,
                              c."create_date"
                          ) <= date_add(
                              'day',
                              -1,
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
                ) p

                GROUP BY GROUPING SETS
                (
                    (
                        p."product_id",
                        p."product_name"
                    ),
                    ()
                )
            ) g
        ) z

        WHERE z."是否汇总" = 0
    ) s

        ON s."product_id" = cfg."product_id"
       AND s."product_name" = cfg."product_name"
) x

ORDER BY
    x."前30日LTV贡献占比",
    x."前30日付费人数占比",
    x."一级分类",
    x."二级分类",
    x."product_id",
    x."product_name";
