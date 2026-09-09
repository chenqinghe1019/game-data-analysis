SELECT
    row_number() OVER (
        ORDER BY
            t."累计付费分层",
            t."玩家ID",
            t."新增天数"
    ) AS "序号",

    t."累计付费分层",
    t."玩家ID",
    t."新增日期",
    t."新增天数",
    t."付费日期",
    round(t."累计付费金额", 2) AS "累计付费金额",
    t."当天购买商品"

FROM
(
    SELECT
        CASE
            WHEN y."累计付费金额" = 0
                THEN 'a_free'
            WHEN y."累计付费金额" <= 6
                THEN 'b_(0,6]'
            WHEN y."累计付费金额" <= 30
                THEN 'c_(6,30]'
            WHEN y."累计付费金额" <= 100
                THEN 'd_(30,100]'
            WHEN y."累计付费金额" <= 300
                THEN 'e_(100,300]'
            WHEN y."累计付费金额" <= 500
                THEN 'f_(300,500]'
            WHEN y."累计付费金额" <= 1000
                THEN 'g_(500,1000]'
            ELSE 'h_(1000,+)'
        END AS "累计付费分层",

        y."#account_id" AS "玩家ID",
        y."新增日期",

        date_diff(
            'day',
            y."新增日期",
            y."付费日期"
        ) + 1 AS "新增天数",

        y."付费日期",
        y."累计付费金额",
        y."当天购买商品"

    FROM
    (
        SELECT
            d."#account_id",
            d."新增日期",
            d."付费日期",
            d."当日付费金额",
            d."当天购买商品",

            sum(d."当日付费金额") OVER (
                PARTITION BY
                    d."#account_id",
                    d."新增日期"
                ORDER BY
                    d."付费日期"
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS "累计付费金额"

        FROM
        (
            SELECT
                p."#account_id",
                p."新增日期",
                p."付费日期",

                sum(
                    p."付费金额"
                ) AS "当日付费金额",

                array_agg(
                    p."商品名称"
                    ORDER BY
                        p."#event_time",
                        p."product_id"
                ) AS "当天购买商品"

            FROM
            (
                SELECT
                    u."#account_id",
                    u."新增日期",

                    e."付费日期",
                    e."#event_time",
                    e."product_id",
                    e."付费金额",

                    coalesce(
                        d."name",
                        concat(
                            '未配置商品_',
                            e."product_id"
                        )
                    ) AS "商品名称"

                FROM
                (
                    SELECT
                        u1."#account_id",
                        u1."新增日期"

                    FROM
                    (
                        SELECT
                            u0."#account_id",
                            u0."新增日期",

                            cast(
                                u0."新增日期"
                                AS varchar
                            ) AS "$part_date"

                        FROM
                        (
                            SELECT
                                cast(
                                    v."#account_id"
                                    AS varchar
                                ) AS "#account_id",

                                min(
                                    coalesce(
                                        date(
                                            try_cast(
                                                cast(
                                                    v."create_role_time"
                                                    AS varchar
                                                )
                                                AS timestamp
                                            )
                                        ),

                                        date(
                                            from_unixtime(
                                                try_cast(
                                                    cast(
                                                        v."create_role_time"
                                                        AS varchar
                                                    )
                                                    AS double
                                                )
                                            )
                                        )
                                    )
                                ) AS "新增日期"

                            FROM ta.v_user_44 v

                            WHERE v."domain" = 'release'
                              AND v."#account_id" IS NOT NULL
                              AND v."create_role_time" IS NOT NULL

                            GROUP BY
                                cast(
                                    v."#account_id"
                                    AS varchar
                                )
                        ) u0

                        WHERE u0."新增日期" IS NOT NULL
                          AND u0."新增日期" <= current_date
                    ) u1

                    WHERE ${PartDate:date1}
                ) u

                INNER JOIN
                (
                    SELECT
                        cast(
                            e0."#account_id"
                            AS varchar
                        ) AS "#account_id",

                        date(
                            e0."#event_time"
                        ) AS "付费日期",

                        date(
                            e0."$part_date"
                        ) AS "分区日期",

                        e0."#event_time",

                        coalesce(
                            cast(
                                try_cast(
                                    e0."product_id"
                                    AS bigint
                                )
                                AS varchar
                            ),
                            cast(
                                e0."product_id"
                                AS varchar
                            )
                        ) AS "product_id",

                        coalesce(
                            try_cast(
                                e0."payment"
                                AS double
                            ),
                            0
                        ) / 100.0000 AS "付费金额"

                    FROM ta.v_event_44 e0

                    WHERE e0."$part_event" = 'pay_log'
                      AND e0."#account_id" IS NOT NULL
                      AND e0."#event_time" IS NOT NULL
                      AND e0."$part_date" IS NOT NULL
                      AND date(e0."$part_date") <= current_date

                      AND coalesce(
                            try_cast(
                                e0."payment"
                                AS double
                            ),
                            0
                          ) > 0
                ) e
                    ON e."#account_id" = u."#account_id"
                   AND e."付费日期" >= u."新增日期"
                   AND e."分区日期" >= u."新增日期"

                LEFT JOIN
                (
                    SELECT
                        coalesce(
                            cast(
                                try_cast(
                                    "product_id"
                                    AS bigint
                                )
                                AS varchar
                            ),
                            cast(
                                "product_id"
                                AS varchar
                            )
                        ) AS "product_id",

                        max(
                            trim(
                                cast(
                                    "name"
                                    AS varchar
                                )
                            )
                        ) AS "name"

                    FROM ta_ext.product_id_44

                    GROUP BY
                        coalesce(
                            cast(
                                try_cast(
                                    "product_id"
                                    AS bigint
                                )
                                AS varchar
                            ),
                            cast(
                                "product_id"
                                AS varchar
                            )
                        )
                ) d
                    ON e."product_id" = d."product_id"
            ) p

            GROUP BY
                p."#account_id",
                p."新增日期",
                p."付费日期"
        ) d
    ) y
) t

ORDER BY
    t."累计付费分层",
    t."玩家ID",
    t."新增天数";