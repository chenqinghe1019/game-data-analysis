SELECT
    row_number() OVER (
        ORDER BY
            a."#account_id",
            a."change_reason"
    ) AS "序号",

    a."#account_id" AS "玩家ID",
    u."角色名",
    u."服务器ID",
    u."创角日期",

    a."change_reason" AS "change_reason",
    a."获取原因",

    a."首次获取时间",
    a."最后获取时间",
    a."获取次数",

    round(
        a."夏日海滩获取数量",
        2
    ) AS "夏日海滩获取数量",

    round(
        coalesce(activity_data."对应活动充值金额", 0),
        2
    ) AS "对应活动充值金额",

    round(
        coalesce(activity_data."能量电池消耗数量", 0),
        2
    ) AS "能量电池消耗数量",

    round(
        coalesce(activity_data."钻石消耗数量", 0),
        2
    ) AS "钻石消耗数量",

    round(
        coalesce(history_pay."历史累充金额", 0),
        2
    ) AS "历史累充金额"

FROM
(
    SELECT
        cast(
            e."#account_id"
            AS varchar
        ) AS "#account_id",

        cast(
            e."change_reason"
            AS varchar
        ) AS "change_reason",

        coalesce(
            max(
                reason_cfg."reason_name"
            ),
            '未映射'
        ) AS "获取原因",

        min(
            e."#event_time"
        ) AS "首次获取时间",

        max(
            e."#event_time"
        ) AS "最后获取时间",

        count(*) AS "获取次数",

        sum(
            coalesce(
                try_cast(
                    e."item_num"
                    AS double
                ),
                0
            )
        ) AS "夏日海滩获取数量"

    FROM ta.v_event_41 e

    INNER JOIN ta.v_user_41 user_info

        ON cast(
            e."#account_id"
            AS varchar
        )
        =
        cast(
            user_info."#account_id"
            AS varchar
        )

    LEFT JOIN
    (
        SELECT
            cast(
                "change_reson"
                AS varchar
            ) AS "change_reson",

            max(
                cast(
                    "reason_name"
                    AS varchar
                )
            ) AS "reason_name"

        FROM ta_ext.change_reason_41

        WHERE "change_reson" IS NOT NULL

        GROUP BY 1
    ) reason_cfg

        ON cast(
            e."change_reason"
            AS varchar
        ) = reason_cfg."change_reson"

    WHERE ${PartDate:date2}

      AND e."domain" = 'release'

      AND e."$part_event" = 'item_log'

      AND e."#account_id" IS NOT NULL

      AND cast(
            e."item_name"
            AS varchar
          ) = '夏日海滩'

      AND try_cast(
            e."change_type"
            AS bigint
          ) = 1

      AND user_info."domain" = 'release'

      AND user_info."server_open_time" IS NOT NULL

      AND
      (
          date_diff(
              'day',
              date(
                  user_info."server_open_time"
              ),
              date(
                  e."#event_time"
              )
          ) + 1
      ) ${Selector:selector2}

    GROUP BY
        1,
        2
) a

LEFT JOIN
(
    SELECT
        cast(
            "#account_id"
            AS varchar
        ) AS "#account_id",

        max(
            cast(
                "nick_name"
                AS varchar
            )
        ) AS "角色名",

        max(
            try_cast(
                "region_id"
                AS bigint
            )
        ) AS "服务器ID",

        min(
            date(
                try_cast(
                    "create_role_time"
                    AS timestamp
                )
            )
        ) AS "创角日期"

    FROM ta.v_user_41

    WHERE "domain" = 'release'

      AND "#account_id" IS NOT NULL

    GROUP BY 1
) u

    ON a."#account_id"
        = u."#account_id"

LEFT JOIN
(
    SELECT
        data."#account_id",

        sum(
            data."单笔活动充值金额"
        ) AS "对应活动充值金额",

        sum(
            data."单笔能量电池消耗"
        ) AS "能量电池消耗数量",

        sum(
            data."单笔钻石消耗"
        ) AS "钻石消耗数量"

    FROM
    (
        SELECT
            cast(
                e."#account_id"
                AS varchar
            ) AS "#account_id",

            CASE
                WHEN e."$part_event" = 'pay_log'

                 AND product_cfg."product_id" IS NOT NULL

                    THEN
                        CASE
                            WHEN coalesce(
                                try_cast(
                                    e."payment"
                                    AS double
                                ),
                                0
                            ) > 0

                                THEN coalesce(
                                    try_cast(
                                        e."payment"
                                        AS double
                                    ),
                                    0
                                ) / 100.0000

                            WHEN coalesce(
                                try_cast(
                                    e."token_payment"
                                    AS double
                                ),
                                0
                            ) > 0

                                THEN coalesce(
                                    try_cast(
                                        e."token_payment"
                                        AS double
                                    ),
                                    0
                                ) / 100.0000

                            ELSE 0
                        END

                ELSE 0
            END AS "单笔活动充值金额",

            CASE
                WHEN e."$part_event" = 'item_log'

                 AND try_cast(
                        e."change_type"
                        AS bigint
                     ) = 2

                 AND cast(
                        e."item_name"
                        AS varchar
                     ) = '能量电池'

                    THEN coalesce(
                        try_cast(
                            e."item_num"
                            AS double
                        ),
                        0
                    )

                ELSE 0
            END AS "单笔能量电池消耗",

            CASE
                WHEN e."$part_event" = 'money_log'

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

                     OR cast(
                         e."item_name"
                         AS varchar
                     ) = '钻石'
                 )

                    THEN coalesce(
                        try_cast(
                            e."item_num"
                            AS double
                        ),
                        0
                    )

                ELSE 0
            END AS "单笔钻石消耗"

        FROM ta.v_event_41 e

        INNER JOIN ta.v_user_41 user_info

            ON cast(
                e."#account_id"
                AS varchar
            )
            =
            cast(
                user_info."#account_id"
                AS varchar
            )

        LEFT JOIN
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

              AND regexp_like(
                    coalesce(
                        cast(
                            "product_type_two"
                            AS varchar
                        ),
                        ''
                    ),
                    '${Selector:selector1}'
              )

            GROUP BY
                1,
                2
        ) product_cfg

            ON e."$part_event" = 'pay_log'

           AND try_cast(
                e."product_id"
                AS bigint
               ) = product_cfg."product_id"

           AND cast(
                e."product_name"
                AS varchar
               ) = product_cfg."product_name"

        WHERE ${PartDate:date2}

          AND e."domain" = 'release'

          AND e."#account_id" IS NOT NULL

          AND user_info."domain" = 'release'

          AND user_info."server_open_time" IS NOT NULL

          AND
          (
              date_diff(
                  'day',
                  date(
                      user_info."server_open_time"
                  ),
                  date(
                      e."#event_time"
                  )
              ) + 1
          ) ${Selector:selector2}

          AND
          (
              (
                  e."$part_event" = 'pay_log'

                  AND product_cfg."product_id" IS NOT NULL

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
              )

              OR

              (
                  e."$part_event" = 'item_log'

                  AND try_cast(
                        e."change_type"
                        AS bigint
                      ) = 2

                  AND cast(
                        e."item_name"
                        AS varchar
                      ) = '能量电池'
              )

              OR

              (
                  e."$part_event" = 'money_log'

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

                      OR cast(
                          e."item_name"
                          AS varchar
                      ) = '钻石'
                  )
              )
          )
    ) data

    GROUP BY 1
) activity_data

    ON a."#account_id"
        = activity_data."#account_id"

LEFT JOIN
(
    SELECT
        cast(
            e."#account_id"
            AS varchar
        ) AS "#account_id",

        sum(
            CASE
                WHEN coalesce(
                    try_cast(
                        e."payment"
                        AS double
                    ),
                    0
                ) > 0

                    THEN coalesce(
                        try_cast(
                            e."payment"
                            AS double
                        ),
                        0
                    ) / 100.0000

                WHEN coalesce(
                    try_cast(
                        e."token_payment"
                        AS double
                    ),
                    0
                ) > 0

                    THEN coalesce(
                        try_cast(
                            e."token_payment"
                            AS double
                        ),
                        0
                    ) / 100.0000

                ELSE 0
            END
        ) AS "历史累充金额"

    FROM ta.v_event_41 e

    WHERE e."$part_date"
            <= cast(
                current_date
                AS varchar
            )

      AND e."domain" = 'release'

      AND e."$part_event" = 'pay_log'

      AND e."#account_id" IS NOT NULL

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

    GROUP BY 1
) history_pay

    ON a."#account_id"
        = history_pay."#account_id"

ORDER BY
    a."#account_id",
    a."change_reason"