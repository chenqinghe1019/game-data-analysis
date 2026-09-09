SELECT
    row_number() over(
        order by r."历史VIP", r."英雄名称"
    ) "序号",
    r."历史VIP",
    r."英雄名称",
    r."D1平均星级",
    r."D2平均星级",
    r."D3平均星级",
    r."D4平均星级",
    r."D5平均星级",
    r."D6平均星级",
    r."D7平均星级",
    r."D8平均星级",
    r."D9平均星级",
    r."D10平均星级",
    r."D11平均星级",
    r."D12平均星级",
    r."D13平均星级",
    r."D14平均星级"
FROM
(
    SELECT
        t."历史VIP",
        t."英雄名称",
        round(avg(CASE WHEN t.days = 0 THEN t."玩家英雄星级" END), 2) "D1平均星级",
        round(avg(CASE WHEN t.days = 1 THEN t."玩家英雄星级" END), 2) "D2平均星级",
        round(avg(CASE WHEN t.days = 2 THEN t."玩家英雄星级" END), 2) "D3平均星级",
        round(avg(CASE WHEN t.days = 3 THEN t."玩家英雄星级" END), 2) "D4平均星级",
        round(avg(CASE WHEN t.days = 4 THEN t."玩家英雄星级" END), 2) "D5平均星级",
        round(avg(CASE WHEN t.days = 5 THEN t."玩家英雄星级" END), 2) "D6平均星级",
        round(avg(CASE WHEN t.days = 6 THEN t."玩家英雄星级" END), 2) "D7平均星级",
        round(avg(CASE WHEN t.days = 7 THEN t."玩家英雄星级" END), 2) "D8平均星级",
        round(avg(CASE WHEN t.days = 8 THEN t."玩家英雄星级" END), 2) "D9平均星级",
        round(avg(CASE WHEN t.days = 9 THEN t."玩家英雄星级" END), 2) "D10平均星级",
        round(avg(CASE WHEN t.days = 10 THEN t."玩家英雄星级" END), 2) "D11平均星级",
        round(avg(CASE WHEN t.days = 11 THEN t."玩家英雄星级" END), 2) "D12平均星级",
        round(avg(CASE WHEN t.days = 12 THEN t."玩家英雄星级" END), 2) "D13平均星级",
        round(avg(CASE WHEN t.days = 13 THEN t."玩家英雄星级" END), 2) "D14平均星级"
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
                cast(e.ins_id AS varchar) ins_id,
                max_by(
                    cast(e.role_id AS varchar),
                    e."#event_time"
                ) hero_name,
                max_by(
                    CASE
                        WHEN e."$part_event" = 'role_obtain_log'
                        THEN try_cast(e.init_star AS double)

                        WHEN e."$part_event" IN ('role_upstar_log', 'role_back_star_log')
                        THEN try_cast(e.nstar AS double)
                    END,
                    e."#event_time"
                ) current_star,
                max_by(
                    CASE
                        WHEN e."$part_event" = 'role_lost_log' THEN 0
                        ELSE 1
                    END,
                    e."#event_time"
                ) is_owned
            FROM
            (
                SELECT
                    d.account_id,
                    d.create_date,
                    d.days,
                    d.target_date,
                    v.vip_level
                FROM
                (
                    SELECT
                        c.account_id,
                        c.create_date,
                        n.days,
                        date_add('day', n.days, c.create_date) target_date
                    FROM
                    (
                        SELECT
                            cast(u."#account_id" AS varchar) account_id,
                            date(u.create_role_time) create_date
                        FROM
                        (
                            SELECT
                                "#account_id",
                                create_role_time,
                                cast(date(create_role_time) AS varchar) "$part_date"
                            FROM ta.v_user_41
                            WHERE create_role_time IS NOT NULL
                        ) u
                        WHERE u.${PartDate:date}
                          AND date_add('day', 13, date(u.create_role_time))
                              <= date_add('day', -1, current_date)
                    ) c
                    CROSS JOIN UNNEST(sequence(0, 13)) AS n(days)
                ) d
                INNER JOIN
                (
                    SELECT
                        "#varchar_id",
                        "$tag_date",
                        max(
                            coalesce(
                                tag_value_num,
                                try_cast(tag_value AS double)
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
                        date_format(d.target_date, '%Y%m%d') AS integer
                   )
            ) ud
            INNER JOIN ta.v_event_41 e
                ON cast(e."#account_id" AS varchar) = ud.account_id
               AND e."$part_event" IN (
                    'role_obtain_log',
                    'role_upstar_log',
                    'role_back_star_log',
                    'role_lost_log'
               )
               AND cast(e."$part_date" AS date)
                   BETWEEN ud.create_date AND ud.target_date
               AND date(e."#event_time")
                   BETWEEN ud.create_date AND ud.target_date
            GROUP BY
                ud.account_id,
                ud.days,
                ud.vip_level,
                cast(e.ins_id AS varchar)
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
