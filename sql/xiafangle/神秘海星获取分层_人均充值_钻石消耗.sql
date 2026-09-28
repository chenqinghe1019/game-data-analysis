-- 下方了｜开服D8+玩家：神秘海星获取数量分层 × 人均充值 × 人均钻石消耗
-- 口径：
-- 1. 玩家范围：${PartDate:date2}内存在in_out_log，且该活跃日相对server_open_time的开服天数>=8。
-- 2. 神秘海星获取：item_log，item_name='神秘海星'，change_type=1；change_type为空时item_num>0兜底。
-- 3. 神秘海星按玩家在统计期内、开服D8+阶段的累计获取数量分层：0单独一档，其余1-5、6-10、11-15……每5个一档。
-- 4. 人均充值金额：同统计期、开服D8+阶段，仅统计${Selector:selector1}命中的product_type_two商品小类；商品按product_id+product_name双键映射，金额为(payment+token_payment)/100，未付费玩家补0。
-- 5. 人均消耗钻石数量：同统计期、开服D8+阶段money_log，钻石(item_id=1或item_name='钻石')，change_type=2，直接使用原始item_num，不做ABS；未消耗玩家补0。

SELECT
    row_number() OVER (
        ORDER BY q."区间排序"
    ) AS "序号",
    q."神秘海星获取区间",
    q."玩家数",
    round(
        q."玩家数" * 1.0000
        / nullif(sum(q."玩家数") OVER (), 0),
        4
    ) AS "玩家占比",
    round(q."人均充值金额", 2) AS "人均充值金额",
    round(q."人均消耗钻石数量", 2) AS "人均消耗钻石数量"

FROM
(
    SELECT
        b."区间排序",

        CASE
            WHEN b."区间排序" = 0
                THEN '0'
            ELSE concat(
                cast(b."区间排序" AS varchar),
                '-',
                cast(b."区间排序" + 4 AS varchar)
            )
        END AS "神秘海星获取区间",

        count(*) AS "玩家数",

        avg(
            cast(
                b."充值金额"
                AS double
            )
        ) AS "人均充值金额",

        avg(
            cast(
                b."钻石消耗数量"
                AS double
            )
        ) AS "人均消耗钻石数量"

    FROM
    (
        SELECT
            p."#account_id",
            p."神秘海星获取数量",
            p."充值金额",
            p."钻石消耗数量",

            CASE
                WHEN p."神秘海星获取数量" <= 0
                    THEN 0
                ELSE cast(
                    floor(
                        (p."神秘海星获取数量" - 1) / 5.0
                    ) * 5 + 1
                    AS bigint
                )
            END AS "区间排序"

        FROM
        (
            SELECT
                a."#account_id",

                coalesce(
                    s."神秘海星获取数量",
                    0
                ) AS "神秘海星获取数量",

                coalesce(
                    pay."充值金额",
                    0
                ) AS "充值金额",

                coalesce(
                    d."钻石消耗数量",
                    0
                ) AS "钻石消耗数量"

            FROM
            (
                SELECT DISTINCT
                    cast(
                        e."#account_id"
                        AS varchar
                    ) AS "#account_id"

                FROM ta.v_event_41 e

                INNER JOIN ta.v_user_41 u
                    ON cast(
                        e."#account_id"
                        AS varchar
                    )
                    =
                    cast(
                        u."#account_id"
                        AS varchar
                    )

                WHERE ${PartDate:date2}
                  AND e."$part_event" = 'in_out_log'
                  AND e."domain" = 'release'
                  AND u."domain" = 'release'
                  AND e."#account_id" IS NOT NULL
                  AND u."server_open_time" IS NOT NULL
                  AND date_diff(
                        'day',
                        date(
                            u."server_open_time"
                        ),
                        date(
                            e."#event_time"
                        )
                      ) + 1 >= 8
            ) a

            LEFT JOIN
            (
                SELECT
                    cast(
                        e."#account_id"
                        AS varchar
                    ) AS "#account_id",

                    sum(
                        abs(
                            coalesce(
                                try_cast(
                                    e."item_num"
                                    AS double
                                ),
                                0
                            )
                        )
                    ) AS "神秘海星获取数量"

                FROM ta.v_event_41 e

                INNER JOIN ta.v_user_41 u
                    ON cast(
                        e."#account_id"
                        AS varchar
                    )
                    =
                    cast(
                        u."#account_id"
                        AS varchar
                    )

                WHERE ${PartDate:date2}
                  AND e."$part_event" = 'item_log'
                  AND e."domain" = 'release'
                  AND u."domain" = 'release'
                  AND e."#account_id" IS NOT NULL
                  AND u."server_open_time" IS NOT NULL
                  AND trim(
                        coalesce(
                            cast(
                                e."item_name"
                                AS varchar
                            ),
                            ''
                        )
                      ) = '神秘海星'
                  AND
                  (
                      try_cast(
                          e."change_type"
                          AS bigint
                      ) = 1

                      OR
                      (
                          e."change_type" IS NULL
                          AND try_cast(
                                e."item_num"
                                AS double
                              ) > 0
                      )
                  )
                  AND date_diff(
                        'day',
                        date(
                            u."server_open_time"
                        ),
                        date(
                            e."#event_time"
                        )
                      ) + 1 >= 8

                GROUP BY
                    1
            ) s
                ON a."#account_id"
                 = s."#account_id"

            LEFT JOIN
            (
                SELECT
                    cast(
                        e."#account_id"
                        AS varchar
                    ) AS "#account_id",

                    sum(
                        coalesce(
                            try_cast(
                                e."payment"
                                AS double
                            ),
                            0
                        )
                        +
                        coalesce(
                            try_cast(
                                e."token_payment"
                                AS double
                            ),
                            0
                        )
                    ) / 100.0000 AS "充值金额"

                FROM ta.v_event_41 e

                INNER JOIN ta.v_user_41 u
                    ON cast(
                        e."#account_id"
                        AS varchar
                    )
                    =
                    cast(
                        u."#account_id"
                        AS varchar
                    )

                INNER JOIN
                (
                    SELECT
                        try_cast(
                            "product_id"
                            AS bigint
                        ) AS "product_id",

                        cast(
                            "product_name"
                            AS varchar
                        ) AS "product_name"

                    FROM ta_ext.product_id_name_41

                    WHERE "product_id" IS NOT NULL
                      AND "product_name" IS NOT NULL

                    GROUP BY
                        1,
                        2

                    HAVING regexp_like(
                        coalesce(
                            max(
                                cast(
                                    "product_type_two"
                                    AS varchar
                                )
                            ),
                            ''
                        ),
                        '${Selector:selector1}'
                    )
                ) product_cfg
                    ON try_cast(
                        e."product_id"
                        AS bigint
                    ) = product_cfg."product_id"

                   AND cast(
                        e."product_name"
                        AS varchar
                    ) = product_cfg."product_name"

                WHERE ${PartDate:date2}
                  AND e."$part_event" = 'pay_log'
                  AND e."domain" = 'release'
                  AND u."domain" = 'release'
                  AND e."#account_id" IS NOT NULL
                  AND u."server_open_time" IS NOT NULL
                  AND
                  (
                      coalesce(
                          try_cast(
                              e."payment"
                              AS double
                          ),
                          0
                      ) > 0

                      OR

                      coalesce(
                          try_cast(
                              e."token_payment"
                              AS double
                          ),
                          0
                      ) > 0
                  )
                  AND date_diff(
                        'day',
                        date(
                            u."server_open_time"
                        ),
                        date(
                            e."#event_time"
                        )
                      ) + 1 >= 8

                GROUP BY
                    1
            ) pay
                ON a."#account_id"
                 = pay."#account_id"

            LEFT JOIN
            (
                SELECT
                    cast(
                        e."#account_id"
                        AS varchar
                    ) AS "#account_id",

                    sum(
                        coalesce(
                            try_cast(
                                e."item_num"
                                AS double
                            ),
                            0
                        )
                    ) AS "钻石消耗数量"

                FROM ta.v_event_41 e

                INNER JOIN ta.v_user_41 u
                    ON cast(
                        e."#account_id"
                        AS varchar
                    )
                    =
                    cast(
                        u."#account_id"
                        AS varchar
                    )

                WHERE ${PartDate:date2}
                  AND e."$part_event" = 'money_log'
                  AND e."domain" = 'release'
                  AND u."domain" = 'release'
                  AND e."#account_id" IS NOT NULL
                  AND u."server_open_time" IS NOT NULL
                  AND try_cast(
                        e."change_type"
                        AS bigint
                      ) = 2
                  AND
                  (
                      try_cast(
                          e."item_id"
                          AS bigint
                      ) = 1

                      OR trim(
                          coalesce(
                              cast(
                                  e."item_name"
                                  AS varchar
                              ),
                              ''
                          )
                      ) = '钻石'
                  )
                  AND date_diff(
                        'day',
                        date(
                            u."server_open_time"
                        ),
                        date(
                            e."#event_time"
                        )
                      ) + 1 >= 8

                GROUP BY
                    1
            ) d
                ON a."#account_id"
                 = d."#account_id"
        ) p
    ) b

    GROUP BY
        b."区间排序"
) q

ORDER BY
    q."区间排序";
