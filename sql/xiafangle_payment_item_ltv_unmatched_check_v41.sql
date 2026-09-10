SELECT
    row_number() OVER (
        ORDER BY
            t."create_date",
            t."event_date",
            t."实际付费金额" DESC,
            t."product_id",
            t."product_name"
    ) "序号",

    t."create_date" "新增日期",
    concat(
        'D',
        cast(
            date_diff(
                'day',
                t."create_date",
                t."event_date"
            ) + 1 AS varchar
        )
    ) "新增第N天",

    CASE
        WHEN t."event_date" < current_date
            THEN '成熟'
        ELSE '未成熟'
    END "成熟状态",

    t."event_date" "付费日期",
    t."product_type",
    t."product_id",
    t."product_name",
    t."未匹配原因",
    t."配置表同ID已有名称",
    t."付费人数",
    t."付费次数",
    t."payment非0次数",
    t."token_payment补位次数",
    round(t."payment取值金额", 2) "payment取值金额",
    round(t."token_payment补位金额", 2) "token_payment补位金额",
    round(t."实际付费金额", 2) "实际付费金额"

FROM
(
    SELECT
        c."create_date",
        date(e."#event_time") "event_date",
        cast(e."product_type" AS varchar) "product_type",
        cast(e."product_id" AS varchar) "product_id",
        cast(e."product_name" AS varchar) "product_name",

        CASE
            WHEN e."product_id" IS NULL
                THEN '埋点product_id为空'
            WHEN e."product_name" IS NULL
                THEN '埋点product_name为空'
            WHEN cfg_id."product_id" IS NOT NULL
                THEN 'product_id存在但product_name不一致'
            ELSE '配置表无此product_id'
        END "未匹配原因",

        cfg_id."配置表同ID已有名称",

        count(
            DISTINCT c."#account_id"
        ) "付费人数",

        count(*) "付费次数",

        count(
            CASE
                WHEN coalesce(
                         try_cast(
                             e."payment"
                             AS double
                         ),
                         0
                     ) <> 0
                    THEN 1
            END
        ) "payment非0次数",

        count(
            CASE
                WHEN coalesce(
                         try_cast(
                             e."payment"
                             AS double
                         ),
                         0
                     ) = 0
                 AND coalesce(
                         try_cast(
                             e."token_payment"
                             AS double
                         ),
                         0
                     ) > 0
                    THEN 1
            END
        ) "token_payment补位次数",

        sum(
            CASE
                WHEN coalesce(
                         try_cast(
                             e."payment"
                             AS double
                         ),
                         0
                     ) <> 0
                    THEN coalesce(
                        try_cast(
                            e."payment"
                            AS double
                        ),
                        0
                    )
                ELSE 0
            END
        ) / 100.0000 "payment取值金额",

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
                ELSE 0
            END
        ) / 100.0000 "token_payment补位金额",

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
        ) / 100.0000 "实际付费金额"

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
                    current_date
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
                    current_date
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
            ) "product_name"

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

    LEFT JOIN
    (
        SELECT
            try_cast(
                "product_id"
                AS bigint
            ) "product_id",

            array_join(
                array_sort(
                    array_distinct(
                        array_agg(
                            cast(
                                "product_name"
                                AS varchar
                            )
                        )
                    )
                ),
                '、'
            ) "配置表同ID已有名称"

        FROM ta_ext.product_id_name_41

        WHERE "product_id" IS NOT NULL
          AND "product_name" IS NOT NULL

        GROUP BY
            1
    ) cfg_id

        ON try_cast(
            e."product_id"
            AS bigint
           ) = cfg_id."product_id"

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

      AND cfg."product_id" IS NULL

    GROUP BY
        1,
        2,
        3,
        4,
        5,
        6,
        7
) t

ORDER BY
    t."create_date",
    t."event_date",
    t."实际付费金额" DESC,
    t."product_id",
    t."product_name";
