SELECT
    row_number() OVER (
        ORDER BY
            x."合服日期",
            x."zone_id",
            x."付费金额" DESC,
            x."product_id",
            x."product_name"
    ) AS "序号",

    x."合服日期",
    x."zone_id",
    x."合服区服范围",
    x."实际统计天数",
    x."对应新增人数",

    x."一级分类",
    x."二级分类",
    x."付费类型",
    x."product_id",
    x."product_name",
    round(x."配置单价", 2) AS "配置单价",

    x."购买人数",
    x."购买次数",

    round(
        x."付费金额",
        2
    ) AS "付费金额",

    coalesce(
        x."付费金额" * 1.0000
        / nullif(
            sum(x."付费金额") OVER (
                PARTITION BY
                    x."合服日期",
                    x."zone_id"
            ),
            0
        ),
        0
    ) AS "付费金额占比",

    round(
        coalesce(
            x."付费金额" * 1.0000
            / nullif(x."购买人数", 0),
            0
        ),
        2
    ) AS "人均付费金额",

    round(
        coalesce(
            x."付费金额" * 1.0000
            / nullif(x."对应新增人数", 0),
            0
        ),
        4
    ) AS "付费项LTV贡献",

    round(
        coalesce(
            sum(x."付费金额") OVER (
                PARTITION BY
                    x."合服日期",
                    x."zone_id"
            ) * 1.0000
            / nullif(x."对应新增人数", 0),
            0
        ),
        4
    ) AS "合服后7日总LTV"

FROM
(
    SELECT
        b.merge_date AS "合服日期",
        b.zone_id AS "zone_id",

        concat(
            cast(b.region_start AS varchar),
            '-',
            cast(b.region_end AS varchar)
        ) AS "合服区服范围",

        b.actual_days AS "实际统计天数",
        b.first_day_new_num AS "对应新增人数",

        coalesce(
            p.product_type_one,
            '未分类'
        ) AS "一级分类",

        coalesce(
            p.product_type_two,
            '未分类'
        ) AS "二级分类",

        coalesce(
            p.product_type,
            '未获取'
        ) AS "付费类型",

        p.product_id AS "product_id",
        p.product_name AS "product_name",

        max(
            coalesce(
                p.price,
                0
            )
        ) AS "配置单价",

        count(
            DISTINCT p."#user_id"
        ) AS "购买人数",

        count(*) AS "购买次数",

        sum(
            p.pay_amount
        ) AS "付费金额"

    FROM
    (
        SELECT
            z.zone_id,
            z.merge_date,
            z.region_start,
            z.region_end,

            coalesce(
                sum(r.first_day_new_num),
                0
            ) AS first_day_new_num,

            least(
                6,
                greatest(
                    date_diff(
                        'day',
                        z.merge_date,
                        current_date
                    ),
                    0
                )
            ) AS end_offset,

            least(
                7,
                greatest(
                    date_diff(
                        'day',
                        z.merge_date,
                        current_date
                    ) + 1,
                    0
                )
            ) AS actual_days

        FROM
        (
            SELECT
                z2.zone_id,
                z2.merge_date,
                z2.zone_id AS region_start,

                CASE
                    WHEN z2.next_zone_id IS NOT NULL
                    THEN z2.next_zone_id - 1

                    ELSE greatest(
                        z2.zone_id,
                        coalesce(
                            max(
                                try_cast(
                                    e2.region_id AS bigint
                                )
                            ),
                            z2.zone_id
                        )
                    )
                END AS region_end

            FROM
            (
                SELECT
                    z1.zone_id,
                    z1.merge_date,

                    lead(
                        z1.zone_id
                    ) OVER (
                        ORDER BY z1.zone_id
                    ) AS next_zone_id

                FROM
                (
                    SELECT
                        try_cast(
                            e.zone_id AS bigint
                        ) AS zone_id,

                        min(
                            cast(
                                e."$part_date" AS date
                            )
                        ) AS merge_date

                    FROM ta.v_event_41 e

                    WHERE
                        e."$part_date" >= '2026-09-07'

                        AND e."$part_date"
                            <= cast(
                                current_date AS varchar
                            )

                        AND e."$part_event" = 'in_out_log'

                        AND try_cast(
                            e.zone_id AS bigint
                        ) IS NOT NULL

                        AND try_cast(
                            e.zone_id AS bigint
                        ) > 0

                    GROUP BY
                        try_cast(
                            e.zone_id AS bigint
                        )
                ) z1
            ) z2

            LEFT JOIN ta.v_event_41 e2
                ON z2.next_zone_id IS NULL

                AND e2."$part_date" >= '2026-09-07'

                AND e2."$part_event" = 'in_out_log'

                AND try_cast(
                    e2.zone_id AS bigint
                ) = z2.zone_id

                AND try_cast(
                    e2.region_id AS bigint
                ) IS NOT NULL

                AND e2."$part_date" BETWEEN
                    cast(
                        z2.merge_date AS varchar
                    )
                    AND
                    cast(
                        date_add(
                            'day',

                            least(
                                6,
                                greatest(
                                    date_diff(
                                        'day',
                                        z2.merge_date,
                                        current_date
                                    ),
                                    0
                                )
                            ),

                            z2.merge_date
                        ) AS varchar
                    )

            GROUP BY
                z2.zone_id,
                z2.merge_date,
                z2.next_zone_id
        ) z

        LEFT JOIN
        (
            SELECT
                x.region_id,

                sum(
                    x.new_user_num
                ) AS first_day_new_num

            FROM
            (
                SELECT
                    y.region_id,
                    y.create_date,
                    y.new_user_num,

                    min(
                        y.create_date
                    ) OVER (
                        PARTITION BY
                            y.region_id
                    ) AS first_create_date

                FROM
                (
                    SELECT
                        try_cast(
                            u.region_id AS bigint
                        ) AS region_id,

                        cast(
                            u.create_role_time AS date
                        ) AS create_date,

                        count(
                            DISTINCT u."#user_id"
                        ) AS new_user_num

                    FROM ta.v_user_41 u

                    WHERE
                        u.create_role_time IS NOT NULL

                        AND try_cast(
                            u.region_id AS bigint
                        ) IS NOT NULL

                    GROUP BY
                        try_cast(
                            u.region_id AS bigint
                        ),

                        cast(
                            u.create_role_time AS date
                        )
                ) y
            ) x

            WHERE
                x.create_date = x.first_create_date

            GROUP BY
                x.region_id
        ) r
            ON r.region_id BETWEEN
                z.region_start
                AND z.region_end

        GROUP BY
            z.zone_id,
            z.merge_date,
            z.region_start,
            z.region_end
    ) b

    INNER JOIN
    (
        SELECT
            cast(
                e."$part_date" AS date
            ) AS stat_date,

            try_cast(
                e.region_id AS bigint
            ) AS region_id,

            e."#user_id",

            coalesce(
                cast(
                    e.product_type AS varchar
                ),
                '未获取'
            ) AS product_type,

            try_cast(
                e.product_id AS bigint
            ) AS product_id,

            coalesce(
                cast(
                    e.product_name AS varchar
                ),
                '未获取'
            ) AS product_name,

            cfg.product_type_one,
            cfg.product_type_two,
            cfg.price,

            coalesce(
                try_cast(
                    e.payment AS double
                ),
                0
            ) / 100.0 AS pay_amount

        FROM ta.v_event_41 e

        LEFT JOIN
        (
            SELECT
                try_cast(
                    product_id AS bigint
                ) AS product_id,

                cast(
                    product_name AS varchar
                ) AS product_name,

                max(
                    cast(
                        product_type_one AS varchar
                    )
                ) AS product_type_one,

                max(
                    cast(
                        product_type_two AS varchar
                    )
                ) AS product_type_two,

                max(
                    try_cast(
                        price AS double
                    )
                ) AS price

            FROM ta_ext.product_id_name_41

            WHERE
                product_id IS NOT NULL

                AND product_name IS NOT NULL

            GROUP BY
                try_cast(
                    product_id AS bigint
                ),

                cast(
                    product_name AS varchar
                )
        ) cfg
            ON try_cast(
                e.product_id AS bigint
            ) = cfg.product_id

            AND cast(
                e.product_name AS varchar
            ) = cfg.product_name

        WHERE
            e."$part_date" >= '2026-09-07'

            AND e."$part_date"
                <= cast(
                    current_date AS varchar
                )

            AND e."$part_event" = 'pay_log'

            AND try_cast(
                e.region_id AS bigint
            ) IS NOT NULL

            AND coalesce(
                try_cast(
                    e.payment AS double
                ),
                0
            ) > 0
    ) p
        ON p.region_id BETWEEN
            b.region_start
            AND b.region_end

        AND p.stat_date BETWEEN
            b.merge_date
            AND date_add(
                'day',
                b.end_offset,
                b.merge_date
            )

    GROUP BY
        b.merge_date,
        b.zone_id,
        b.region_start,
        b.region_end,
        b.actual_days,
        b.first_day_new_num,

        coalesce(
            p.product_type_one,
            '未分类'
        ),

        coalesce(
            p.product_type_two,
            '未分类'
        ),

        coalesce(
            p.product_type,
            '未获取'
        ),

        p.product_id,
        p.product_name
) x

ORDER BY
    x."合服日期",
    x."zone_id",
    x."付费金额" DESC,
    x."product_id",
    x."product_name";