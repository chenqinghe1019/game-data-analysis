-- 下方了｜夏日活动：每累计消耗10个能量电池的大奖概率
-- 口径：
-- 1. 统计周期：${PartDate:date2}
-- 2. 活动开服天数：${Selector:selector2}，夏日活动可填 >=8
-- 3. 抽取：item_log，item_name='能量电池'，change_type=2
-- 4. 按玩家累计能量电池消耗量，每10个划分一个区间：1-10、11-20、21-30……
-- 5. 本次抽取中奖：从本次能量电池消耗事件开始，到下一次能量电池消耗事件之前，
--    存在 item_log 获取 item_name='夏日海滩' 且 change_reason=14817、change_type=1
-- 6. 人数大奖概率 = 大奖获取人数 / 抽取人数
-- 7. 次数大奖概率 = 大奖获取次数 / 抽取次数；同一抽取窗口内即使出现多条大奖获取事件，只记1次中奖抽取

SELECT
    row_number() OVER (
        ORDER BY q."区间起始"
    ) AS "序号",

    concat(
        cast(q."区间起始" AS varchar),
        '-',
        cast(q."区间起始" + 9 AS varchar)
    ) AS "累计能量电池消耗区间",

    q."抽取人数",
    q."大奖获取人数",

    round(
        q."大奖获取人数" * 1.0000
        / nullif(q."抽取人数", 0),
        4
    ) AS "人数大奖概率",

    q."抽取次数",
    q."大奖获取次数",

    round(
        q."大奖获取次数" * 1.0000
        / nullif(q."抽取次数", 0),
        4
    ) AS "次数大奖概率"

FROM
(
    SELECT
        d."区间起始",

        count(
            DISTINCT d."#account_id"
        ) AS "抽取人数",

        count(
            DISTINCT CASE
                WHEN d."是否获取大奖" = 1
                    THEN d."#account_id"
            END
        ) AS "大奖获取人数",

        count(*) AS "抽取次数",

        sum(
            d."是否获取大奖"
        ) AS "大奖获取次数"

    FROM
    (
        SELECT
            draw."#account_id",
            draw."抽取时间",
            draw."下一次抽取时间",
            draw."累计能量电池消耗",

            cast(
                floor(
                    (
                        draw."累计能量电池消耗" - 1
                    ) / 10.0
                ) * 10 + 1
                AS bigint
            ) AS "区间起始",

            max(
                CASE
                    WHEN reward."#account_id" IS NOT NULL
                        THEN 1
                    ELSE 0
                END
            ) AS "是否获取大奖"

        FROM
        (
            SELECT
                x."#account_id",
                x."抽取时间",
                x."单次能量电池消耗",

                sum(
                    x."单次能量电池消耗"
                ) OVER (
                    PARTITION BY
                        x."#account_id"
                    ORDER BY
                        x."抽取时间"
                    ROWS BETWEEN UNBOUNDED PRECEDING
                         AND CURRENT ROW
                ) AS "累计能量电池消耗",

                lead(
                    x."抽取时间"
                ) OVER (
                    PARTITION BY
                        x."#account_id"
                    ORDER BY
                        x."抽取时间"
                ) AS "下一次抽取时间"

            FROM
            (
                SELECT
                    cast(
                        e."#account_id"
                        AS varchar
                    ) AS "#account_id",

                    cast(
                        e."#event_time"
                        AS timestamp
                    ) AS "抽取时间",

                    coalesce(
                        try_cast(
                            e."item_num"
                            AS double
                        ),
                        0
                    ) AS "单次能量电池消耗"

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
                  AND e."domain" = 'release'
                  AND u."domain" = 'release'
                  AND e."$part_event" = 'item_log'
                  AND e."#account_id" IS NOT NULL
                  AND u."server_open_time" IS NOT NULL

                  AND cast(
                        e."item_name"
                        AS varchar
                      ) = '能量电池'

                  AND try_cast(
                        e."change_type"
                        AS bigint
                      ) = 2

                  AND coalesce(
                        try_cast(
                            e."item_num"
                            AS double
                        ),
                        0
                      ) > 0

                  AND
                  (
                      date_diff(
                          'day',
                          date(
                              u."server_open_time"
                          ),
                          date(
                              e."#event_time"
                          )
                      ) + 1
                  ) ${Selector:selector2}
            ) x
        ) draw

        LEFT JOIN
        (
            SELECT
                cast(
                    e."#account_id"
                    AS varchar
                ) AS "#account_id",

                cast(
                    e."#event_time"
                    AS timestamp
                ) AS "获取时间"

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
              AND e."domain" = 'release'
              AND u."domain" = 'release'
              AND e."$part_event" = 'item_log'
              AND e."#account_id" IS NOT NULL
              AND u."server_open_time" IS NOT NULL

              AND cast(
                    e."item_name"
                    AS varchar
                  ) = '夏日海滩'

              AND try_cast(
                    e."change_type"
                    AS bigint
                  ) = 1

              AND try_cast(
                    e."change_reason"
                    AS bigint
                  ) = 14817

              AND
              (
                  date_diff(
                      'day',
                      date(
                          u."server_open_time"
                      ),
                      date(
                          e."#event_time"
                      )
                  ) + 1
              ) ${Selector:selector2}
        ) reward

            ON draw."#account_id"
             = reward."#account_id"

           AND reward."获取时间"
                >= draw."抽取时间"

           AND
           (
               draw."下一次抽取时间" IS NULL

               OR reward."获取时间"
                    < draw."下一次抽取时间"
           )

        WHERE draw."累计能量电池消耗" > 0

        GROUP BY
            draw."#account_id",
            draw."抽取时间",
            draw."下一次抽取时间",
            draw."累计能量电池消耗"
    ) d

    GROUP BY
        d."区间起始"
) q

ORDER BY
    q."区间起始";
