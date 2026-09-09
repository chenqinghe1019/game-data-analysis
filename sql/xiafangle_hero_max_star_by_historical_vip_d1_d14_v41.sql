SELECT
    row_number() over(
        order by r."历史VIP", r."英雄名称"
    ) "序号",
    r."历史VIP",
    r."英雄名称",
    r."D1最高星级",
    r."D2最高星级",
    r."D3最高星级",
    r."D4最高星级",
    r."D5最高星级",
    r."D6最高星级",
    r."D7最高星级",
    r."D8最高星级",
    r."D9最高星级",
    r."D10最高星级",
    r."D11最高星级",
    r."D12最高星级",
    r."D13最高星级",
    r."D14最高星级"

FROM
(
    SELECT
        t."历史VIP",
        t."英雄名称",

        CASE
            WHEN count(CASE WHEN t.days = 0 THEN 1 END) = 0
            THEN '无获取'
            ELSE cast(max(CASE WHEN t.days = 0 THEN t."玩家英雄星级" END) AS varchar)
        END "D1最高星级",

        CASE
            WHEN count(CASE WHEN t.days = 1 THEN 1 END) = 0
            THEN '无获取'
            ELSE cast(max(CASE WHEN t.days = 1 THEN t."玩家英雄星级" END) AS varchar)
        END "D2最高星级",

        CASE
            WHEN count(CASE WHEN t.days = 2 THEN 1 END) = 0
            THEN '无获取'
            ELSE cast(max(CASE WHEN t.days = 2 THEN t."玩家英雄星级" END) AS varchar)
        END "D3最高星级",

        CASE
            WHEN count(CASE WHEN t.days = 3 THEN 1 END) = 0
            THEN '无获取'
            ELSE cast(max(CASE WHEN t.days = 3 THEN t."玩家英雄星级" END) AS varchar)
        END "D4最高星级",

        CASE
            WHEN count(CASE WHEN t.days = 4 THEN 1 END) = 0
            THEN '无获取'
            ELSE cast(max(CASE WHEN t.days = 4 THEN t."玩家英雄星级" END) AS varchar)
        END "D5最高星级",

        CASE
            WHEN count(CASE WHEN t.days = 5 THEN 1 END) = 0
            THEN '无获取'
            ELSE cast(max(CASE WHEN t.days = 5 THEN t."玩家英雄星级" END) AS varchar)
        END "D6最高星级",

        CASE
            WHEN count(CASE WHEN t.days = 6 THEN 1 END) = 0
            THEN '无获取'
            ELSE cast(max(CASE WHEN t.days = 6 THEN t."玩家英雄星级" END) AS varchar)
        END "D7最高星级",

        CASE
            WHEN count(CASE WHEN t.days = 7 THEN 1 END) = 0
            THEN '无获取'
            ELSE cast(max(CASE WHEN t.days = 7 THEN t."玩家英雄星级" END) AS varchar)
        END "D8最高星级",

        CASE
            WHEN count(CASE WHEN t.days = 8 THEN 1 END) = 0
            THEN '无获取'
            ELSE cast(max(CASE WHEN t.days = 8 THEN t."玩家英雄星级" END) AS varchar)
        END "D9最高星级",

        CASE
            WHEN count(CASE WHEN t.days = 9 THEN 1 END) = 0
            THEN '无获取'
            ELSE cast(max(CASE WHEN t.days = 9 THEN t."玩家英雄星级" END) AS varchar)
        END "D10最高星级",

        CASE
            WHEN count(CASE WHEN t.days = 10 THEN 1 END) = 0
            THEN '无获取'
            ELSE cast(max(CASE WHEN t.days = 10 THEN t."玩家英雄星级" END) AS varchar)
        END "D11最高星级",

        CASE
            WHEN count(CASE WHEN t.days = 11 THEN 1 END) = 0
            THEN '无获取'
            ELSE cast(max(CASE WHEN t.days = 11 THEN t."玩家英雄星级" END) AS varchar)
        END "D12最高星级",

        CASE
            WHEN count(CASE WHEN t.days = 12 THEN 1 END) = 0
            THEN '无获取'
            ELSE cast(max(CASE WHEN t.days = 12 THEN t."玩家英雄星级" END) AS varchar)
        END "D13最高星级",

        CASE
            WHEN count(CASE WHEN t.days = 13 THEN 1 END) = 0
            THEN '无获取'
            ELSE cast(max(CASE WHEN t.days = 13 THEN t."玩家英雄星级" END) AS varchar)
        END "D14最高星级"

    FROM
    (
        SELECT
            s.account_id,
            s.days,
            cast(s.vip_level AS bigint) "历史VIP",
            s.hero_name "英雄名称",
            max(s.current_star) "玩家英雄星级"

        FROM
        (
            SELECT
                ud.account_id,
                ud.days,
                ud.vip_level,
                ev.ins_id,

                coalesce(
                    max(ev.dim_hero_name),
                    max(ev.raw_role_id)
                ) hero_name,

                max_by(
                    ev.star_value,
                    ev.event_time
                ) FILTER (
                    WHERE ev.star_value IS NOT NULL
                ) current_star,

                max_by(
                    ev.is_owned,
                    ev.event_time
                ) is_owned

            FROM
            (
                SELECT
                    d.account_id,
                    d.create_date,
                    d.days,
                    d.target_date,
                    coalesce(v.vip_level, 0) vip_level

                FROM
                (
                    SELECT
                        c.account_id,
                        c.create_date,
                        n.days,

                        date_add(
                            'day',
                            n.days,
                            c.create_date
                        ) target_date

                    FROM
                    (
                        SELECT
                            cast(
                                u."#account_id" AS varchar
                            ) account_id,

                            date(
                                u.create_role_time
                            ) create_date

                        FROM
                        (
                            SELECT
                                "#account_id",
                                create_role_time,

                                cast(
                                    date(create_role_time) AS varchar
                                ) "$part_date"

                            FROM ta.v_user_41

                            WHERE create_role_time IS NOT NULL
                        ) u

                        WHERE u.${PartDate:date}
                    ) c

                    CROSS JOIN UNNEST(
                        sequence(0, 13)
                    ) AS n(days)

                    WHERE date_add(
                              'day',
                              n.days,
                              c.create_date
                          )
                          <= date_add(
                              'day',
                              -1,
                              current_date
                          )
                ) d

                LEFT JOIN
                (
                    SELECT
                        "#varchar_id",
                        "$tag_date",

                        max(
                            coalesce(
                                tag_value_num,
                                0
                            )
                        ) vip_level

                    FROM ta.history_tag_41

                    WHERE cluster_name = 'vip_level_today'

                    GROUP BY
                        "#varchar_id",
                        "$tag_date"
                ) v

                    ON d.account_id = v."#varchar_id"

                   AND v."$tag_date" = cast(
                        date_format(
                            d.target_date,
                            '%Y%m%d'
                        ) AS integer
                   )
            ) ud

            INNER JOIN
            (
                SELECT
                    cast(
                        e."#account_id" AS varchar
                    ) account_id,

                    e."#event_time" event_time,

                    cast(
                        e."$part_date" AS date
                    ) event_date,

                    e."$part_event" part_event,

                    cast(
                        e.ins_id AS varchar
                    ) ins_id,

                    cast(
                        e.role_id AS varchar
                    ) raw_role_id,

                    h."heroname" dim_hero_name,

                    CASE
                        WHEN e."$part_event" = 'role_obtain_log'
                        THEN coalesce(
                            try_cast(
                                e.init_star AS double
                            ),
                            try_cast(
                                h."star" AS double
                            )
                        )

                        WHEN e."$part_event" IN (
                            'role_upstar_log',
                            'role_back_star_log'
                        )
                        THEN try_cast(
                            e.nstar AS double
                        )
                    END star_value,

                    CASE
                        WHEN e."$part_event" = 'role_lost_log'
                        THEN 0
                        ELSE 1
                    END is_owned

                FROM ta.v_event_41 e

                LEFT JOIN ta_ext.heroid_41 h

                    ON cast(
                        e.role_id AS varchar
                       )
                       =
                       cast(
                        h."heroname" AS varchar
                       )

                WHERE e."$part_event" IN (
                    'role_obtain_log',
                    'role_upstar_log',
                    'role_back_star_log',
                    'role_lost_log'
                )

                  AND e."#account_id" IS NOT NULL
            ) ev

                ON ev.account_id = ud.account_id

               AND ev.event_date
                   BETWEEN ud.create_date
                       AND ud.target_date

               AND date(ev.event_time)
                   BETWEEN ud.create_date
                       AND ud.target_date

            GROUP BY
                ud.account_id,
                ud.days,
                ud.vip_level,
                ev.ins_id
        ) s

        WHERE s.is_owned = 1
          AND s.current_star IS NOT NULL
          AND s.hero_name IS NOT NULL

        GROUP BY
            s.account_id,
            s.days,
            cast(s.vip_level AS bigint),
            s.hero_name
    ) t

    GROUP BY
        t."历史VIP",
        t."英雄名称"
) r

ORDER BY
    r."历史VIP",
    r."英雄名称"
