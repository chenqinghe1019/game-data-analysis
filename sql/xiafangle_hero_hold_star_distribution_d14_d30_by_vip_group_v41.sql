select      row_number() over(
                order by q.period_sort,q.vip_sort,q."英雄名称",q.star_sort
            ) "序号",
            q."统计周期",
            q."VIP等级",
            q."英雄名称",
            q."成熟玩家数",
            q."英雄持有人数",
            round(
                q."英雄持有人数" * 1.0000
                / nullif(q."成熟玩家数",0),
                4
            ) "英雄持有率",
            q."星级",
            q."该星级人数",
            round(
                q."该星级人数" * 1.0000
                / nullif(q."英雄持有人数",0),
                4
            ) "星级分布"
from
(
    select      vp.period_sort,
                vp.vip_sort,
                vp."统计周期",
                vp."VIP等级",
                h."英雄名称",
                vp."成熟玩家数",
                coalesce(sf."英雄持有人数",0) "英雄持有人数",
                case
                    when coalesce(sf."英雄持有人数",0) = 0 then '无获取'
                    else cast(cast(sf."玩家英雄星级" as bigint) as varchar)
                end "星级",
                coalesce(sf."该星级人数",0) "该星级人数",
                case
                    when coalesce(sf."英雄持有人数",0) = 0 then -1
                    else cast(sf."玩家英雄星级" as bigint)
                end star_sort
    from
    (
        select      p.period_sort,
                    case
                        when g.vip_group = '汇总' then 0
                        when g.vip_group = 'a.V0-V3' then 1
                        when g.vip_group = 'b.V4-V6' then 2
                        when g.vip_group = 'c.V7-V9' then 3
                        when g.vip_group = 'd.V10+' then 4
                    end vip_sort,
                    p."统计周期",
                    g.vip_group "VIP等级",
                    count(distinct p.account_id) "成熟玩家数"
        from
        (
            select      d.period_sort,
                        d."统计周期",
                        d.user_id,
                        d.account_id,
                        d.create_date,
                        d.target_date,
                        coalesce(v.vip_level,0) vip_level
            from
            (
                select      c.user_id,
                            c.account_id,
                            c.create_date,
                            p.period_sort,
                            p."统计周期",
                            date_add('day',p.target_days,c.create_date) target_date
                from
                (
                    select      u."#user_id" user_id,
                                cast(u."#account_id" as varchar) account_id,
                                date(u.create_role_time) create_date
                    from
                    (
                        select      "#user_id",
                                    "#account_id",
                                    create_role_time,
                                    cast(date(create_role_time) as varchar) "$part_date"
                        from        ta.v_user_41
                        where       create_role_time is not null
                    )u
                    where       u.${PartDate:date}
                )c
                cross join
                (
                    values
                        (1,'前14天汇总',13),
                        (2,'前30天汇总',29)
                ) p(period_sort,"统计周期",target_days)
                where       date_add('day',p.target_days,c.create_date)
                            <= date_add('day',-1,current_date)
            )d
            left join
            (
                select      "#long_id",
                            "$tag_date",
                            max(coalesce(tag_value_num,0)) vip_level
                from        ta.history_tag_41
                where       cluster_name = 'vip_level_today'
                group by    1,2
            )v
                on          d.user_id = v."#long_id"
                and         v."$tag_date" = cast(
                                date_format(d.target_date,'%Y%m%d')
                                as integer
                            )
        )p
        cross join unnest(
            array[
                '汇总',
                case
                    when p.vip_level <= 3 then 'a.V0-V3'
                    when p.vip_level <= 6 then 'b.V4-V6'
                    when p.vip_level <= 9 then 'c.V7-V9'
                    else 'd.V10+'
                end
            ]
        ) as g(vip_group)
        group by    1,2,3,4
    )vp
    cross join
    (
        select distinct
                    cast("heroname" as varchar) "英雄名称"
        from        ta_ext.heroid_41
        where       "heroname" is not null
    )h
    left join
    (
        select      sc.period_sort,
                    sc.vip_sort,
                    sc."统计周期",
                    sc."VIP等级",
                    sc."英雄名称",
                    sc."玩家英雄星级",
                    sc."该星级人数",
                    sum(sc."该星级人数") over(
                        partition by
                            sc.period_sort,
                            sc."VIP等级",
                            sc."英雄名称"
                    ) "英雄持有人数"
        from
        (
            select      t.period_sort,
                        case
                            when g.vip_group = '汇总' then 0
                            when g.vip_group = 'a.V0-V3' then 1
                            when g.vip_group = 'b.V4-V6' then 2
                            when g.vip_group = 'c.V7-V9' then 3
                            when g.vip_group = 'd.V10+' then 4
                        end vip_sort,
                        t."统计周期",
                        g.vip_group "VIP等级",
                        t."英雄名称",
                        t."玩家英雄星级",
                        count(distinct t.account_id) "该星级人数"
            from
            (
                select      s.period_sort,
                            s."统计周期",
                            s.account_id,
                            s.vip_level,
                            s.hero_name "英雄名称",
                            max(s.current_star) "玩家英雄星级"
                from
                (
                    select      ud.period_sort,
                                ud."统计周期",
                                ud.account_id,
                                ud.vip_level,
                                ev.ins_id,
                                coalesce(
                                    max(ev.dim_hero_name),
                                    max(ev.raw_role_id)
                                ) hero_name,
                                max_by(
                                    ev.star_value,
                                    ev.event_time
                                ) filter (
                                    where ev.star_value is not null
                                ) current_star,
                                max_by(
                                    ev.is_owned,
                                    ev.event_time
                                ) is_owned
                    from
                    (
                        select      d.period_sort,
                                    d."统计周期",
                                    d.user_id,
                                    d.account_id,
                                    d.create_date,
                                    d.target_date,
                                    coalesce(v.vip_level,0) vip_level
                        from
                        (
                            select      c.user_id,
                                        c.account_id,
                                        c.create_date,
                                        p.period_sort,
                                        p."统计周期",
                                        date_add('day',p.target_days,c.create_date) target_date
                            from
                            (
                                select      u."#user_id" user_id,
                                            cast(u."#account_id" as varchar) account_id,
                                            date(u.create_role_time) create_date
                                from
                                (
                                    select      "#user_id",
                                                "#account_id",
                                                create_role_time,
                                                cast(date(create_role_time) as varchar) "$part_date"
                                    from        ta.v_user_41
                                    where       create_role_time is not null
                                )u
                                where       u.${PartDate:date}
                            )c
                            cross join
                            (
                                values
                                    (1,'前14天汇总',13),
                                    (2,'前30天汇总',29)
                            ) p(period_sort,"统计周期",target_days)
                            where       date_add('day',p.target_days,c.create_date)
                                        <= date_add('day',-1,current_date)
                        )d
                        left join
                        (
                            select      "#long_id",
                                        "$tag_date",
                                        max(coalesce(tag_value_num,0)) vip_level
                            from        ta.history_tag_41
                            where       cluster_name = 'vip_level_today'
                            group by    1,2
                        )v
                            on          d.user_id = v."#long_id"
                            and         v."$tag_date" = cast(
                                            date_format(d.target_date,'%Y%m%d')
                                            as integer
                                        )
                    )ud
                    inner join
                    (
                        select      cast(e."#account_id" as varchar) account_id,
                                    e."#event_time" event_time,
                                    cast(e."$part_date" as date) event_date,
                                    e."$part_event" part_event,
                                    cast(e.ins_id as varchar) ins_id,
                                    cast(e.role_id as varchar) raw_role_id,
                                    cast(h."heroname" as varchar) dim_hero_name,
                                    case
                                        when e."$part_event" = 'role_obtain_log'
                                        then coalesce(
                                            try_cast(e.init_star as double),
                                            try_cast(h."star" as double)
                                        )
                                        when e."$part_event" in (
                                            'role_upstar_log',
                                            'role_back_star_log'
                                        )
                                        then try_cast(e.nstar as double)
                                    end star_value,
                                    case
                                        when e."$part_event" = 'role_lost_log' then 0
                                        else 1
                                    end is_owned
                        from        ta.v_event_41 e
                        left join   ta_ext.heroid_41 h
                            on      cast(e.role_id as varchar)
                                    = cast(h."heroname" as varchar)
                        where       e."$part_event" in (
                                        'role_obtain_log',
                                        'role_upstar_log',
                                        'role_back_star_log',
                                        'role_lost_log'
                                    )
                                    and e."#account_id" is not null
                    )ev
                        on          ev.account_id = ud.account_id
                        and         ev.event_date between ud.create_date and ud.target_date
                        and         date(ev.event_time) between ud.create_date and ud.target_date
                    group by
                                ud.period_sort,
                                ud."统计周期",
                                ud.account_id,
                                ud.vip_level,
                                ev.ins_id
                )s
                where       s.is_owned = 1
                            and s.current_star is not null
                            and s.hero_name is not null
                group by    1,2,3,4,5
            )t
            cross join unnest(
                array[
                    '汇总',
                    case
                        when t.vip_level <= 3 then 'a.V0-V3'
                        when t.vip_level <= 6 then 'b.V4-V6'
                        when t.vip_level <= 9 then 'c.V7-V9'
                        else 'd.V10+'
                    end
                ]
            ) as g(vip_group)
            group by    1,2,3,4,5,6
        )sc
    )sf
        on          vp.period_sort = sf.period_sort
        and         vp."VIP等级" = sf."VIP等级"
        and         h."英雄名称" = sf."英雄名称"
)q
order by    q.period_sort,
            q.vip_sort,
            q."英雄名称",
            q.star_sort
