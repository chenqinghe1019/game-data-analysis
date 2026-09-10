SELECT
    row_number() OVER (
        ORDER BY
            t."分层排序",
            t."开服天数"
    ) AS "序号",
    t."首日付费分层",
    t."开服天数",
    t."活跃人数",
    t."星际参与率",
    t."星际人均参与次数",
    t."星际巡航战令付费率",
    t."七日目标第五天付费礼包",
    t."商城专武大礼包",
    t."高级专武礼包",
    t."专武福利礼包",
    t."竞技场战令",
    t."七日目标第三天付费礼包",
    t."洗练大礼包",
    t."徽章洗练大礼包",
    t."高级徽章礼包",
    t."七日目标第四天礼包",
    t."种植战令",
    t."种植特权卡",
    t."种植礼包",
    t."坐骑礼包",
    t."种植加速礼包",
    t."种植福利礼包",
    t."坐骑洗练大礼包",
    t."七日目标第六天付费礼包",
    t."藏品计划",
    t."藏品弹出礼包",
    t."藏品升级礼包",
    t."藏品搜寻礼包",
    t."藏品福利礼包",
    t."高级搜寻礼包"
FROM
(
    SELECT
        x."首日付费分层",
        x."分层排序",
        x."开服天数",
        count(DISTINCT x."#account_id") AS "活跃人数",

        cast(
            round(
                count(
                    DISTINCT CASE
                        WHEN x."星际参与次数" > 0
                            THEN x."#account_id"
                    END
                ) * 1.0000
                /
                nullif(
                    count(DISTINCT x."#account_id"),
                    0
                ),
                4
            ) AS decimal(18, 4)
        ) AS "星际参与率",

        cast(
            round(
                sum(x."星际参与次数") * 1.0000
                /
                nullif(
                    count(
                        DISTINCT CASE
                            WHEN x."星际参与次数" > 0
                                THEN x."#account_id"
                        END
                    ),
                    0
                ),
                2
            ) AS decimal(18, 2)
        ) AS "星际人均参与次数",

        cast(round(sum(x."p40") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "星际巡航战令付费率",
        cast(round(sum(x."p819") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "七日目标第五天付费礼包",
        cast(round(sum(x."p113") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "商城专武大礼包",
        cast(round(sum(x."p263") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "高级专武礼包",
        cast(round(sum(x."p256") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "专武福利礼包",
        cast(round(sum(x."p401") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "竞技场战令",
        cast(round(sum(x."p811") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "七日目标第三天付费礼包",
        cast(round(sum(x."p114") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "洗练大礼包",
        cast(round(sum(x."p264") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "徽章洗练大礼包",
        cast(round(sum(x."p259") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "高级徽章礼包",
        cast(round(sum(x."p815") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "七日目标第四天礼包",
        cast(round(sum(x."p74011") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "种植战令",
        cast(round(sum(x."p74009") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "种植特权卡",
        cast(round(sum(x."p109") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "种植礼包",
        cast(round(sum(x."p112") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "坐骑礼包",
        cast(round(sum(x."p255") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "种植加速礼包",
        cast(round(sum(x."p258") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "种植福利礼包",
        cast(round(sum(x."p261") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "坐骑洗练大礼包",
        cast(round(sum(x."p823") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "七日目标第六天付费礼包",
        cast(round(sum(x."p_collection_plan") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "藏品计划",
        cast(round(sum(x."p_collection_popup") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "藏品弹出礼包",
        cast(round(sum(x."p108") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "藏品升级礼包",
        cast(round(sum(x."p111") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "藏品搜寻礼包",
        cast(round(sum(x."p257") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "藏品福利礼包",
        cast(round(sum(x."p260") * 1.0000 / nullif(count(DISTINCT x."#account_id"), 0), 4) AS decimal(18, 4)) AS "高级搜寻礼包"

    FROM
    (
        SELECT
            a."#account_id",
            c."首日付费分层",
            c."分层排序",
            date_diff(
                'day',
                c.server_open_date,
                a.event_date
            ) + 1 AS "开服天数",
            coalesce(a.star_count, 0) AS "星际参与次数",
            coalesce(p.p40, 0) AS p40,
            coalesce(p.p819, 0) AS p819,
            coalesce(p.p113, 0) AS p113,
            coalesce(p.p263, 0) AS p263,
            coalesce(p.p256, 0) AS p256,
            coalesce(p.p401, 0) AS p401,
            coalesce(p.p811, 0) AS p811,
            coalesce(p.p114, 0) AS p114,
            coalesce(p.p264, 0) AS p264,
            coalesce(p.p259, 0) AS p259,
            coalesce(p.p815, 0) AS p815,
            coalesce(p.p74011, 0) AS p74011,
            coalesce(p.p74009, 0) AS p74009,
            coalesce(p.p109, 0) AS p109,
            coalesce(p.p112, 0) AS p112,
            coalesce(p.p255, 0) AS p255,
            coalesce(p.p258, 0) AS p258,
            coalesce(p.p261, 0) AS p261,
            coalesce(p.p823, 0) AS p823,
            coalesce(p.p_collection_plan, 0) AS p_collection_plan,
            coalesce(p.p_collection_popup, 0) AS p_collection_popup,
            coalesce(p.p108, 0) AS p108,
            coalesce(p.p111, 0) AS p111,
            coalesce(p.p257, 0) AS p257,
            coalesce(p.p260, 0) AS p260

        FROM
        (
            SELECT
                u.create_date,
                u.server_open_date,
                u."#account_id",

                CASE
                    WHEN coalesce(fp.first_day_pay, 0) = 0 THEN 'a_free'
                    WHEN coalesce(fp.first_day_pay, 0) <= 6 THEN 'b_(0,6]'
                    WHEN coalesce(fp.first_day_pay, 0) <= 30 THEN 'c_(6,30]'
                    WHEN coalesce(fp.first_day_pay, 0) <= 100 THEN 'd_(30,100]'
                    WHEN coalesce(fp.first_day_pay, 0) <= 300 THEN 'e_(100,300]'
                    WHEN coalesce(fp.first_day_pay, 0) <= 500 THEN 'f_(300,500]'
                    WHEN coalesce(fp.first_day_pay, 0) <= 1000 THEN 'g_(500,1000]'
                    ELSE 'h_(1000,+)'
                END AS "首日付费分层",

                CASE
                    WHEN coalesce(fp.first_day_pay, 0) = 0 THEN 1
                    WHEN coalesce(fp.first_day_pay, 0) <= 6 THEN 2
                    WHEN coalesce(fp.first_day_pay, 0) <= 30 THEN 3
                    WHEN coalesce(fp.first_day_pay, 0) <= 100 THEN 4
                    WHEN coalesce(fp.first_day_pay, 0) <= 300 THEN 5
                    WHEN coalesce(fp.first_day_pay, 0) <= 500 THEN 6
                    WHEN coalesce(fp.first_day_pay, 0) <= 1000 THEN 7
                    ELSE 8
                END AS "分层排序"

            FROM
            (
                SELECT DISTINCT
                    user_raw.create_date,
                    user_raw.server_open_date,
                    user_raw."$part_date",
                    user_raw."#account_id"
                FROM
                (
                    SELECT
                        coalesce(
                            date(try_cast(cast(v."create_role_time" AS varchar) AS timestamp)),
                            date(from_unixtime(try_cast(cast(v."create_role_time" AS varchar) AS double)))
                        ) AS create_date,

                        coalesce(
                            date(try_cast(cast(v."server_open_time" AS varchar) AS timestamp)),
                            date(from_unixtime(try_cast(cast(v."server_open_time" AS varchar) AS double)))
                        ) AS server_open_date,

                        cast(
                            coalesce(
                                date(try_cast(cast(v."create_role_time" AS varchar) AS timestamp)),
                                date(from_unixtime(try_cast(cast(v."create_role_time" AS varchar) AS double)))
                            ) AS varchar
                        ) AS "$part_date",

                        cast(v."#account_id" AS varchar) AS "#account_id"

                    FROM ta.v_user_44 v
                    WHERE v."domain" = 'release'
                      AND v."#account_id" IS NOT NULL
                      AND v."create_role_time" IS NOT NULL
                      AND v."server_open_time" IS NOT NULL
                ) user_raw
                WHERE user_raw.create_date IS NOT NULL
                  AND user_raw.server_open_date IS NOT NULL
                  AND user_raw.create_date < current_date
                  AND user_raw.${PartDate:date}
            ) u

            LEFT JOIN
            (
                SELECT
                    cast(pay_e."#account_id" AS varchar) AS "#account_id",
                    date(pay_e."#event_time") AS pay_date,
                    sum(
                        coalesce(
                            try_cast(pay_e."payment" AS double),
                            0
                        )
                    ) / 100.0000 AS first_day_pay

                FROM ta.v_event_44 pay_e

                CROSS JOIN
                (
                    SELECT
                        min(range_raw.create_date) AS min_create_date,
                        max(range_raw.create_date) AS max_create_date
                    FROM
                    (
                        SELECT
                            coalesce(
                                date(try_cast(cast(v1."create_role_time" AS varchar) AS timestamp)),
                                date(from_unixtime(try_cast(cast(v1."create_role_time" AS varchar) AS double)))
                            ) AS create_date,
                            cast(
                                coalesce(
                                    date(try_cast(cast(v1."create_role_time" AS varchar) AS timestamp)),
                                    date(from_unixtime(try_cast(cast(v1."create_role_time" AS varchar) AS double)))
                                ) AS varchar
                            ) AS "$part_date"
                        FROM ta.v_user_44 v1
                        WHERE v1."domain" = 'release'
                          AND v1."#account_id" IS NOT NULL
                          AND v1."create_role_time" IS NOT NULL
                    ) range_raw
                    WHERE range_raw.create_date IS NOT NULL
                      AND range_raw.create_date < current_date
                      AND range_raw.${PartDate:date}
                ) pay_range

                WHERE pay_e."$part_event" = 'pay_log'
                  AND pay_e."#account_id" IS NOT NULL
                  AND coalesce(try_cast(pay_e."payment" AS double), 0) > 0
                  AND date(pay_e."$part_date") BETWEEN pay_range.min_create_date AND pay_range.max_create_date
                  AND date(pay_e."#event_time") BETWEEN pay_range.min_create_date AND pay_range.max_create_date

                GROUP BY
                    cast(pay_e."#account_id" AS varchar),
                    date(pay_e."#event_time")
            ) fp
                ON u."#account_id" = fp."#account_id"
               AND u.create_date = fp.pay_date
        ) c

        INNER JOIN
        (
            SELECT
                cast(e."#account_id" AS varchar) AS "#account_id",
                date(e."#event_time") AS event_date,
                count(
                    DISTINCT CASE
                        WHEN e."$part_event" = 'battle_result'
                         AND try_cast(e."battle_type" AS bigint) = 37
                            THEN coalesce(
                                nullif(trim(cast(e."battle_uid" AS varchar)), ''),
                                cast(e."#event_time" AS varchar)
                            )
                    END
                ) AS star_count,
                max(
                    CASE
                        WHEN e."$part_event" = 'in_out_log'
                            THEN 1
                        ELSE 0
                    END
                ) AS is_active

            FROM ta.v_event_44 e

            CROSS JOIN
            (
                SELECT
                    min(range_raw.create_date) AS min_create_date
                FROM
                (
                    SELECT
                        coalesce(
                            date(try_cast(cast(v2."create_role_time" AS varchar) AS timestamp)),
                            date(from_unixtime(try_cast(cast(v2."create_role_time" AS varchar) AS double)))
                        ) AS create_date,
                        cast(
                            coalesce(
                                date(try_cast(cast(v2."create_role_time" AS varchar) AS timestamp)),
                                date(from_unixtime(try_cast(cast(v2."create_role_time" AS varchar) AS double)))
                            ) AS varchar
                        ) AS "$part_date"
                    FROM ta.v_user_44 v2
                    WHERE v2."domain" = 'release'
                      AND v2."#account_id" IS NOT NULL
                      AND v2."create_role_time" IS NOT NULL
                ) range_raw
                WHERE range_raw.create_date IS NOT NULL
                  AND range_raw.create_date < current_date
                  AND range_raw.${PartDate:date}
            ) event_range

            WHERE e."$part_event" IN ('in_out_log', 'battle_result')
              AND e."#account_id" IS NOT NULL
              AND date(e."$part_date") BETWEEN event_range.min_create_date AND date_add('day', -1, current_date)
              AND date(e."#event_time") BETWEEN event_range.min_create_date AND date_add('day', -1, current_date)

            GROUP BY
                cast(e."#account_id" AS varchar),
                date(e."#event_time")
        ) a
            ON c."#account_id" = a."#account_id"
           AND a.is_active = 1
           AND a.event_date >= c.create_date

        LEFT JOIN
        (
            SELECT
                cast(p."#account_id" AS varchar) AS "#account_id",
                date(p."#event_time") AS pay_date,

                max(CASE WHEN try_cast(p."product_id" AS bigint) = 40 THEN 1 ELSE 0 END) AS p40,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 819 THEN 1 ELSE 0 END) AS p819,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 113 THEN 1 ELSE 0 END) AS p113,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 263 THEN 1 ELSE 0 END) AS p263,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 256 THEN 1 ELSE 0 END) AS p256,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 401 THEN 1 ELSE 0 END) AS p401,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 811 THEN 1 ELSE 0 END) AS p811,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 114 THEN 1 ELSE 0 END) AS p114,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 264 THEN 1 ELSE 0 END) AS p264,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 259 THEN 1 ELSE 0 END) AS p259,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 815 THEN 1 ELSE 0 END) AS p815,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 74011 THEN 1 ELSE 0 END) AS p74011,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 74009 THEN 1 ELSE 0 END) AS p74009,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 109 THEN 1 ELSE 0 END) AS p109,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 112 THEN 1 ELSE 0 END) AS p112,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 255 THEN 1 ELSE 0 END) AS p255,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 258 THEN 1 ELSE 0 END) AS p258,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 261 THEN 1 ELSE 0 END) AS p261,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 823 THEN 1 ELSE 0 END) AS p823,
                max(CASE WHEN try_cast(p."product_id" AS bigint) IN (901, 902, 903, 904, 905, 906, 907) THEN 1 ELSE 0 END) AS p_collection_plan,
                max(CASE WHEN try_cast(p."product_id" AS bigint) IN (40004, 40005, 40006) THEN 1 ELSE 0 END) AS p_collection_popup,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 108 THEN 1 ELSE 0 END) AS p108,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 111 THEN 1 ELSE 0 END) AS p111,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 257 THEN 1 ELSE 0 END) AS p257,
                max(CASE WHEN try_cast(p."product_id" AS bigint) = 260 THEN 1 ELSE 0 END) AS p260

            FROM ta.v_event_44 p

            CROSS JOIN
            (
                SELECT
                    min(range_raw.create_date) AS min_create_date
                FROM
                (
                    SELECT
                        coalesce(
                            date(try_cast(cast(v3."create_role_time" AS varchar) AS timestamp)),
                            date(from_unixtime(try_cast(cast(v3."create_role_time" AS varchar) AS double)))
                        ) AS create_date,
                        cast(
                            coalesce(
                                date(try_cast(cast(v3."create_role_time" AS varchar) AS timestamp)),
                                date(from_unixtime(try_cast(cast(v3."create_role_time" AS varchar) AS double)))
                            ) AS varchar
                        ) AS "$part_date"
                    FROM ta.v_user_44 v3
                    WHERE v3."domain" = 'release'
                      AND v3."#account_id" IS NOT NULL
                      AND v3."create_role_time" IS NOT NULL
                ) range_raw
                WHERE range_raw.create_date IS NOT NULL
                  AND range_raw.create_date < current_date
                  AND range_raw.${PartDate:date}
            ) pay_range

            WHERE p."$part_event" = 'pay_log'
              AND p."#account_id" IS NOT NULL
              AND coalesce(try_cast(p."payment" AS double), 0) > 0
              AND try_cast(p."product_id" AS bigint) IN (
                    40, 819, 113, 263, 256, 401, 811, 114, 264, 259,
                    815, 74011, 74009, 109, 112, 255, 258, 261, 823,
                    901, 902, 903, 904, 905, 906, 907,
                    40004, 40005, 40006,
                    108, 111, 257, 260
                  )
              AND date(p."$part_date") BETWEEN pay_range.min_create_date AND date_add('day', -1, current_date)
              AND date(p."#event_time") BETWEEN pay_range.min_create_date AND date_add('day', -1, current_date)

            GROUP BY
                cast(p."#account_id" AS varchar),
                date(p."#event_time")
        ) p
            ON a."#account_id" = p."#account_id"
           AND a.event_date = p.pay_date

        WHERE date_diff('day', c.server_open_date, a.event_date) + 1 >= 1
    ) x

    GROUP BY
        x."首日付费分层",
        x."分层排序",
        x."开服天数"
) t
ORDER BY
    t."分层排序",
    t."开服天数";