-- 下方了｜夏日活动：每累计消耗10个能量电池的大奖概率（累计抽取版）
-- 口径：
-- 1. 统计周期：${PartDate:date2}
-- 2. 活动开服天数：${Selector:selector2}，夏日活动填 >=8
-- 3. 抽取：item_log，item_name='能量电池'，change_type=2；item_num消耗可能为负数，统一转为正向消耗量
-- 4. 玩家按累计能量电池消耗量，每10个划分区间：1-10、11-20、21-30……
-- 5. 某次抽取中奖：从本次能量电池消耗时间开始，到下一次能量电池消耗时间之前，
--    存在item_log获取item_name='夏日海滩'、change_reason=14817、change_type=1
-- 6. 玩家一旦首次抽到夏日海滩，后续抽取全部停止计入
-- 7. 抽取人数：达到该累计消耗区间、且此前尚未抽中大奖的去重玩家数
-- 8. 累计抽取次数：1个能量电池=1次抽奖；对达到该区间的每个玩家，取截至该区间最后一次抽取时的累计能量电池消耗量，再跨玩家求和
-- 9. 玩家首次抽到夏日海滩后停止统计，后续区间不再计入
-- 10. 人数大奖概率 = 该区间首次中大奖人数 / 该区间抽取人数
-- 11. 次数大奖概率 = 该区间大奖获取次数 / 该区间累计抽取次数

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

    q."累计抽取次数",
    q."大奖获取次数",

    round(
        q."大奖获取次数" * 1.0000
        / nullif(q."累计抽取次数", 0),
        4
    ) AS "次数大奖概率"

FROM
(
    SELECT
        p."区间起始",

        count(*) AS "抽取人数",

        sum(
            p."该区间是否获取大奖"
        ) AS "大奖获取人数",

        sum(
            p."截至该区间累计抽取次数"
        ) AS "累计抽取次数",

        sum(
            p."该区间大奖获取次数"
        ) AS "大奖获取次数"

    FROM
    (
        SELECT
            y."#account_id",
            y."区间起始",

            max(
                y."累计能量电池消耗"
            ) AS "截至该区间累计抽取次数",

            max(
                y."是否获取大奖"
            ) AS "该区间是否获取大奖",

            sum(
                y."大奖获取次数"
            ) AS "该区间大奖获取次数"

        FROM
        (
            SELECT
                z."#account_id",
                z."抽取序号",
                z."累计能量电池消耗",

                cast(
                    floor(
                        (
                            z."累计能量电池消耗" - 1
                        ) / 10.0
                    ) * 10 + 1
                    AS bigint
                ) AS "区间起始",

                z."是否获取大奖",
                z."大奖获取次数",

                min(
                    CASE
                        WHEN z."是否获取大奖" = 1
                            THEN z."抽取序号"
                    END
                ) OVER (
                    PARTITION BY
                        z."#account_id"
                ) AS "首次中大奖抽取序号"

            FROM
            (
                SELECT
                    draw."#account_id",
                    draw."抽取序号",
                    draw."抽取时间",
                    draw."下一次抽取时间",
                    draw."累计能量电池消耗",

                    CASE
                        WHEN count(
                            reward."#account_id"
                        ) > 0
                            THEN 1
                        ELSE 0
                    END AS "是否获取大奖",

                    CASE
                        WHEN count(
                            reward."#account_id"
                        ) > 0
                            THEN 1
                        ELSE 0
                    END AS "大奖获取次数"

                FROM
                (
                    SELECT
                        x."#account_id",
                        x."抽取时间",
                        x."单次能量电池消耗",

                        row_number() OVER (
                            PARTITION BY
                                x."#account_id"
                            ORDER BY
                                x."抽取时间"
                        ) AS "抽取序号",

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

                            CASE
                                WHEN coalesce(
                                    try_cast(
                                        e."item_num"
                                        AS double
                                    ),
                                    0
                                ) < 0
                                    THEN 0 - coalesce(
                                        try_cast(
                                            e."item_num"
                                            AS double
                                        ),
                                        0
                                    )
                                ELSE coalesce(
                                    try_cast(
                                        e."item_num"
                                        AS double
                                    ),
                                    0
                                )
                            END AS "单次能量电池消耗"

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
                              ) <> 0

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

                GROUP BY
                    draw."#account_id",
                    draw."抽取序号",
                    draw."抽取时间",
                    draw."下一次抽取时间",
                    draw."累计能量电池消耗"
            ) z
        ) y

        WHERE
            y."首次中大奖抽取序号" IS NULL

            OR y."抽取序号"
                <= y."首次中大奖抽取序号"

        GROUP BY
            y."#account_id",
            y."区间起始"
    ) p

    GROUP BY
        p."区间起始"
) q

ORDER BY
    q."区间起始";
