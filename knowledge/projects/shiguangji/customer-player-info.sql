-- 时光鸡客服查询；金额按目标项目已有大盘口径转元。
-- 账号汇总先计算，再应用角色/渠道/区服/创角日期筛选。
SELECT "#account_id" AS "角色ID",
       nick_name AS "角色名称",
       reg_channel AS "创角渠道",
       role_payment AS "角色历史累充rmb",
       region_id AS "服务器ID",
       create_time AS "创角时间",
       last_online AS "最后时间",
       date_diff('day', date(last_online), current_date) AS "流失天数",
       media_name AS "媒体平台",
       fighting_power AS "战力",
       nb_open_id AS "星云聚合openID",
       open_id AS "渠道openID",
       account_payment AS "账号历史累充rmb",
       active_channel AS "首次激活渠道",
       account_create_time AS "账号首次出现时间",
       account_last_online AS "账号最后时间"
FROM (
    SELECT r.*,
           sum(role_payment) OVER (PARTITION BY account_key) AS account_payment,
           first_value(reg_channel) OVER (
               PARTITION BY account_key ORDER BY create_time, "#account_id"
           ) AS active_channel,
           min(create_time) OVER (PARTITION BY account_key) AS account_create_time,
           max(last_online) OVER (PARTITION BY account_key) AS account_last_online
    FROM (
        SELECT u."#account_id", u.nick_name, u.region_id, u.fighting_power,
               u.nb_open_id, u.open_id,
               coalesce(nullif(u.nb_open_id, ''), nullif(u.open_id, ''), u."#account_id") AS account_key,
               coalesce(u.ad_platform, '自然量') AS media_name,
               u.channel_id AS reg_channel,
               from_unixtime(u.create_role_time) AS create_time,
               u.latest_online_time AS last_online,
               coalesce(p.role_payment, 0) AS role_payment
        FROM ta.v_user_36 u
        LEFT JOIN (
            SELECT "#account_id", sum(payment) / 100.0 AS role_payment
            FROM ta.v_event_36
            WHERE "$part_event" = 'pay_log'
              AND "$part_date" >= '2024-05-23'
              AND date("$part_date") <= current_date
              AND "#event_time" >= timestamp '2024-05-23 10:49:00'
              AND domain = 'release'
              AND change_reason = 1 AND pay_result = 1
            GROUP BY "#account_id"
        ) p ON u."#account_id" = p."#account_id"
        WHERE u.domain = 'release'
          AND u."#active_time" >= timestamp '2024-05-23 10:49:00'
          AND u."#reg_time" IS NOT NULL
          AND u.create_role_time > 0
    ) r
) account_info
WHERE "#account_id"${Text:text1}
  AND try_cast(reg_channel AS double)${Number:number2}
  AND region_id${Number:number3}
  AND date(create_time)${Time:time4}
ORDER BY role_payment DESC, "#account_id"