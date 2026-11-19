# 萝卜4大盘广告与时长补充（2026-11-19）

看板37_1017，报表3513（分媒体）、3846（汇总）。用户明确要求保留原DAU、新增人数与原始指标，仅补充14个字段。完整原大盘作为b子查询，附加指标独立按日期/媒体聚合后LEFT JOIN，避免支付订单重复放大。

补充字段使用video_play_start观看、video_play_end完播，参考活跃为ta_mg_show，新增日期为register事件最早分区日期。身份按本大盘open_id去重。人均观看/完播分别除以观看/完播人数，渗透率除以参考活跃人数。新增首日同理，分母为register日当日ta_mg_show活跃open_id。时长仅统计当日活跃玩家的ta_mg_hide.#duration，单条<86400秒，再除60转分钟。无有效分母时比率和人均为NULL。

原DAU来自register/guide_complete/login，原新增来自用户first_login_time/1000。补充字段采用参考口径，不能直接拿原DAU或原新增人数复算渗透率。媒体保持原ad_platform分组，用IS NOT DISTINCT FROM关联NULL媒体。

显示比率为0–1、四位小数，人均次数/分钟两位。原历史扫描起点2025-10-30保留。最近七天分媒体与汇总的观看/完播/新增首日观看次数一致，用户ID无重复，新增观看人数未超过总观看人数。

## 3513

```sql
-- 原大盘人数、付费与新增定义保留。以下新增广告/时长字段参照萝卜4广告及关卡看板。
-- 活跃=ta_mg_show，新增=register日期，人数按本大盘open_id去重。
-- 人均广告次数分母为对应观看/完播人数；渗透率分母为参考活跃人数，区别于原DAU。
-- 在线时长=ta_mg_hide.#duration/60，仅纳入单条时长<86400秒且当日活跃的玩家；比率输出0至1。
SELECT b.*,
       coalesce(a.views, 0) AS "视频观看次数",
       cast(round(1.000000 * a.views / nullif(a.viewers, 0), 2) AS decimal(18,2)) AS "人均观看次数",
       coalesce(a.viewers, 0) AS "观看人数",
       cast(round(1.000000 * a.viewers / nullif(a.active_users, 0), 4) AS decimal(18,4)) AS "广告渗透率",
       coalesce(a.completes, 0) AS "视频完播次数",
       cast(round(1.000000 * a.completes / nullif(a.completers, 0), 2) AS decimal(18,2)) AS "人均完播次数",
       coalesce(a.completers, 0) AS "完播人数",
       cast(round(1.000000 * a.completes / nullif(a.views, 0), 4) AS decimal(18,4)) AS "完播率",
       coalesce(a.new_views, 0) AS "新增首日视频观看次数",
       cast(round(1.000000 * a.new_views / nullif(a.new_viewers, 0), 2) AS decimal(18,2)) AS "新增首日人均观看次数",
       coalesce(a.new_viewers, 0) AS "新增首日观看人数",
       cast(round(1.000000 * a.new_viewers / nullif(a.new_active_users, 0), 4) AS decimal(18,4)) AS "新增首日广告渗透率",
       cast(round(a.new_active_minutes / nullif(a.new_active_users, 0), 2) AS decimal(18,2)) AS "新增首日人均在线时长_分钟",
       cast(round(a.active_minutes / nullif(a.active_users, 0), 2) AS decimal(18,2)) AS "活跃人均在线时长_分钟"
FROM (
SELECT 
date(logindate) "日期",
"ad_platform" "媒体平台",
count(DISTINCT if(login_days=1,"open_id",NULL)) "新增账号数",
count(DISTINCT if(login_days=1,"#account_id",NULL)) "新增角色数",
count(DISTINCT if(pay_days=1 ,"open_id",NULL)) "新增首日付费账号数",
round(sum(if(pay_days=1,payment,0)),0) "新增首日充值金额",
cast(if(count(DISTINCT if(login_days=1,"open_id",NULL))=0,0,
count(DISTINCT if(pay_days=1 ,"open_id",NULL))*1.00*100/count(DISTINCT if(login_days=1,"open_id",NULL))) AS varchar)||'%' "新增首日付费率",
if(count(DISTINCT if(login_days=1,"open_id",NULL))=0,0,
round(sum(if(pay_days=1,payment,0))*1.00/count(DISTINCT if(login_days=1,"open_id",NULL)),2)) "新增首日ARPU",
if(count(DISTINCT if(pay_days=1,"open_id",NULL))=0,0,
round(sum(if(pay_days=1,payment,0))*1.00/count(DISTINCT if(pay_days=1,"open_id",NULL)),2)) "新增首日ARPPU",
----------------------------- 新增 --------------------------------------
round(sum(if("#os"='iOS',payment,0)),0) "IOS内购流水",
round(sum(if("#os"<>'iOS',payment,0)),0) "安卓内购流水",
round(sum(payment),0) "内购流水",
count(DISTINCT "open_id") "DAU",

count(DISTINCT if(payment>0 ,"open_id",NULL)) "付费人数",
cast(if(count(DISTINCT "open_id")=0,0,
count(DISTINCT if(payment>0 ,"open_id",NULL))*1.00*100/count(DISTINCT "open_id")) AS varchar)||'%' "付费率",
if(count(DISTINCT "open_id")=0,0,
round(sum(payment)*1.00/count(DISTINCT  "open_id"),2)) "ARPU",
if(count(DISTINCT if(payment>0 ,"open_id",NULL))=0,0,
round(sum(payment)*1.00/count(DISTINCT if(payment>0 ,"open_id",NULL)),2)) "ARPPU"
FROM 
(
SELECT "ad_platform","#os","open_id",t_3."#account_id",date(create_role_time) create_role_date,logindate,paydate,payment
,date_diff('day',date(create_role_time),date(logindate))+1 login_days
,date_diff('day',date(create_role_time),date(paydate))+1 pay_days

FROM 
(
SELECT   "#os",t_1."#account_id",logindate,paydate,"order_id" ,"product_id","product_name",payment
FROM 
(
SELECT "#account_id","$part_date" logindate,count(1) 
FROM v_event_37 WHERE "$part_event" in ('register','guide_complete','login') AND  "$part_date">='2025-10-30'
GROUP BY "#account_id","$part_date"
) t_1
LEFT JOIN 
(
SELECT "#account_id","#event_time","$part_date" paydate,"#os","order_id" ,"product_id","product_name","pay_amount" payment
FROM v_event_37 WHERE "$part_event"='order_finish' AND "$part_date">='2025-10-30'
) t_2
ON t_1."#account_id"=t_2."#account_id" AND t_1.logindate=t_2.paydate
) t_3
LEFT JOIN 
(
SELECT "#account_id","open_id","channel","ad_platform",from_unixtime("first_login_time"/1000) create_role_time,from_unixtime("last_login_time") last_login_time
FROM ta.v_user_37 
) t_4
on t_3."#account_id"=t_4."#account_id"
)
--- WHERE date(create_role_date) >=date('2025-10-21')
GROUP BY date(logindate),"ad_platform"

) b
LEFT JOIN (
SELECT day, media_name,
       sum(views) AS views, sum(completes) AS completes,
       count(DISTINCT CASE WHEN views > 0 THEN pid END) AS viewers,
       count(DISTINCT CASE WHEN completes > 0 THEN pid END) AS completers,
       count(DISTINCT CASE WHEN active_events > 0 THEN pid END) AS active_users,
       sum(new_views) AS new_views,
       count(DISTINCT CASE WHEN new_views > 0 THEN pid END) AS new_viewers,
       count(DISTINCT CASE WHEN active_events > 0 AND is_new = 1 THEN pid END) AS new_active_users,
       sum(CASE WHEN active_events > 0 THEN minutes ELSE 0 END) AS active_minutes,
       sum(CASE WHEN active_events > 0 THEN new_minutes ELSE 0 END) AS new_active_minutes
FROM (
SELECT e."$part_date" AS day, u."open_id" AS pid, u.media_name,
       count_if(e."$part_event" = 'ta_mg_show') AS active_events,
       count_if(e."$part_event" = 'video_play_start') AS views,
       count_if(e."$part_event" = 'video_play_end') AS completes,
       count_if(e."$part_event" = 'video_play_start' AND e."$part_date" = u.reg_day) AS new_views,
       max(CASE WHEN e."$part_date" = u.reg_day THEN 1 ELSE 0 END) AS is_new,
       sum(CASE WHEN e."$part_event" = 'ta_mg_hide' AND e."#duration" < 86400
                THEN coalesce(try_cast(e."#duration" AS double), 0) ELSE 0 END) / 60.0 AS minutes,
       sum(CASE WHEN e."$part_event" = 'ta_mg_hide' AND e."#duration" < 86400 AND e."$part_date" = u.reg_day
                THEN coalesce(try_cast(e."#duration" AS double), 0) ELSE 0 END) / 60.0 AS new_minutes
FROM ta.v_event_37 e
JOIN (
SELECT u."#user_id", u."open_id", cast(u.ad_platform AS varchar) AS media_name, r.reg_day
FROM ta.v_user_37 u
JOIN (
    SELECT "#user_id", min("$part_date") AS reg_day
    FROM ta.v_event_37
    WHERE "$part_event" = 'register'
    GROUP BY 1
) r ON u."#user_id" = r."#user_id"
WHERE nullif(u."open_id", '') IS NOT NULL
) u ON e."#user_id" = u."#user_id"
WHERE e."$part_event" IN ('ta_mg_show', 'video_play_start', 'video_play_end', 'ta_mg_hide')
  AND e."$part_date" >= '2025-10-30'
GROUP BY e."$part_date", u."open_id", u.media_name
) player_day
GROUP BY day, media_name
) a ON b."日期" = date(a.day) AND b."媒体平台" IS NOT DISTINCT FROM a.media_name
ORDER BY b."日期" DESC, b."媒体平台"
```

## 3846

```sql
-- 原大盘人数、付费与新增定义保留。以下新增广告/时长字段参照萝卜4广告及关卡看板。
-- 活跃=ta_mg_show，新增=register日期，人数按本大盘open_id去重。
-- 人均广告次数分母为对应观看/完播人数；渗透率分母为参考活跃人数，区别于原DAU。
-- 在线时长=ta_mg_hide.#duration/60，仅纳入单条时长<86400秒且当日活跃的玩家；比率输出0至1。
SELECT b.*,
       coalesce(a.views, 0) AS "视频观看次数",
       cast(round(1.000000 * a.views / nullif(a.viewers, 0), 2) AS decimal(18,2)) AS "人均观看次数",
       coalesce(a.viewers, 0) AS "观看人数",
       cast(round(1.000000 * a.viewers / nullif(a.active_users, 0), 4) AS decimal(18,4)) AS "广告渗透率",
       coalesce(a.completes, 0) AS "视频完播次数",
       cast(round(1.000000 * a.completes / nullif(a.completers, 0), 2) AS decimal(18,2)) AS "人均完播次数",
       coalesce(a.completers, 0) AS "完播人数",
       cast(round(1.000000 * a.completes / nullif(a.views, 0), 4) AS decimal(18,4)) AS "完播率",
       coalesce(a.new_views, 0) AS "新增首日视频观看次数",
       cast(round(1.000000 * a.new_views / nullif(a.new_viewers, 0), 2) AS decimal(18,2)) AS "新增首日人均观看次数",
       coalesce(a.new_viewers, 0) AS "新增首日观看人数",
       cast(round(1.000000 * a.new_viewers / nullif(a.new_active_users, 0), 4) AS decimal(18,4)) AS "新增首日广告渗透率",
       cast(round(a.new_active_minutes / nullif(a.new_active_users, 0), 2) AS decimal(18,2)) AS "新增首日人均在线时长_分钟",
       cast(round(a.active_minutes / nullif(a.active_users, 0), 2) AS decimal(18,2)) AS "活跃人均在线时长_分钟"
FROM (
SELECT 
date(logindate) "日期",
--- "ad_platform" "媒体平台",
count(DISTINCT if(login_days=1,"open_id",NULL)) "新增账号数",
count(DISTINCT if(login_days=1,"#account_id",NULL)) "新增角色数",
count(DISTINCT if(pay_days=1 ,"open_id",NULL)) "新增首日付费账号数",
round(sum(if(pay_days=1,payment,0)),0) "新增首日充值金额",
cast(if(count(DISTINCT if(login_days=1,"open_id",NULL))=0,0,
count(DISTINCT if(pay_days=1 ,"open_id",NULL))*1.00*100/count(DISTINCT if(login_days=1,"open_id",NULL))) AS varchar)||'%' "新增首日付费率",
if(count(DISTINCT if(login_days=1,"open_id",NULL))=0,0,
round(sum(if(pay_days=1,payment,0))*1.00/count(DISTINCT if(login_days=1,"open_id",NULL)),2)) "新增首日ARPU",
if(count(DISTINCT if(pay_days=1,"open_id",NULL))=0,0,
round(sum(if(pay_days=1,payment,0))*1.00/count(DISTINCT if(pay_days=1,"open_id",NULL)),2)) "新增首日ARPPU",
----------------------------- 新增 --------------------------------------
round(sum(if("#os"='iOS',payment,0)),0) "IOS内购流水",
round(sum(if("#os"<>'iOS',payment,0)),0) "安卓内购流水",
round(sum(payment),0) "内购流水",
count(DISTINCT "open_id") "DAU",

count(DISTINCT if(payment>0 ,"open_id",NULL)) "付费人数",
cast(if(count(DISTINCT "open_id")=0,0,
count(DISTINCT if(payment>0 ,"open_id",NULL))*1.00*100/count(DISTINCT "open_id")) AS varchar)||'%' "付费率",
if(count(DISTINCT "open_id")=0,0,
round(sum(payment)*1.00/count(DISTINCT  "open_id"),2)) "ARPU",
if(count(DISTINCT if(payment>0 ,"open_id",NULL))=0,0,
round(sum(payment)*1.00/count(DISTINCT if(payment>0 ,"open_id",NULL)),2)) "ARPPU"
FROM 
(
SELECT "ad_platform","#os","open_id",t_3."#account_id",date(create_role_time) create_role_date,logindate,paydate,payment
,date_diff('day',date(create_role_time),date(logindate))+1 login_days
,date_diff('day',date(create_role_time),date(paydate))+1 pay_days

FROM 
(
SELECT   "#os",t_1."#account_id",logindate,paydate,"order_id" ,"product_id","product_name",payment
FROM 
(
SELECT "#account_id","$part_date" logindate,count(1) 
FROM v_event_37 WHERE "$part_event" in ('register','guide_complete','login') AND  "$part_date">='2025-10-30'
GROUP BY "#account_id","$part_date"
) t_1
LEFT JOIN 
(
SELECT "#account_id","#event_time","$part_date" paydate,"#os","order_id" ,"product_id","product_name","pay_amount" payment
FROM v_event_37 WHERE "$part_event"='order_finish' AND "$part_date">='2025-10-30'
) t_2
ON t_1."#account_id"=t_2."#account_id" AND t_1.logindate=t_2.paydate
) t_3
LEFT JOIN 
(
SELECT "#account_id","open_id","channel","ad_platform",from_unixtime("first_login_time"/1000) create_role_time,from_unixtime("last_login_time") last_login_time
FROM ta.v_user_37 
) t_4
on t_3."#account_id"=t_4."#account_id"
)
--- WHERE date(create_role_date) >=date('2025-10-21')
GROUP BY date(logindate)--- ,"ad_platform"

) b
LEFT JOIN (
SELECT day,
       sum(views) AS views, sum(completes) AS completes,
       count(DISTINCT CASE WHEN views > 0 THEN pid END) AS viewers,
       count(DISTINCT CASE WHEN completes > 0 THEN pid END) AS completers,
       count(DISTINCT CASE WHEN active_events > 0 THEN pid END) AS active_users,
       sum(new_views) AS new_views,
       count(DISTINCT CASE WHEN new_views > 0 THEN pid END) AS new_viewers,
       count(DISTINCT CASE WHEN active_events > 0 AND is_new = 1 THEN pid END) AS new_active_users,
       sum(CASE WHEN active_events > 0 THEN minutes ELSE 0 END) AS active_minutes,
       sum(CASE WHEN active_events > 0 THEN new_minutes ELSE 0 END) AS new_active_minutes
FROM (
SELECT e."$part_date" AS day, u."open_id" AS pid, u.media_name,
       count_if(e."$part_event" = 'ta_mg_show') AS active_events,
       count_if(e."$part_event" = 'video_play_start') AS views,
       count_if(e."$part_event" = 'video_play_end') AS completes,
       count_if(e."$part_event" = 'video_play_start' AND e."$part_date" = u.reg_day) AS new_views,
       max(CASE WHEN e."$part_date" = u.reg_day THEN 1 ELSE 0 END) AS is_new,
       sum(CASE WHEN e."$part_event" = 'ta_mg_hide' AND e."#duration" < 86400
                THEN coalesce(try_cast(e."#duration" AS double), 0) ELSE 0 END) / 60.0 AS minutes,
       sum(CASE WHEN e."$part_event" = 'ta_mg_hide' AND e."#duration" < 86400 AND e."$part_date" = u.reg_day
                THEN coalesce(try_cast(e."#duration" AS double), 0) ELSE 0 END) / 60.0 AS new_minutes
FROM ta.v_event_37 e
JOIN (
SELECT u."#user_id", u."open_id", cast(u.ad_platform AS varchar) AS media_name, r.reg_day
FROM ta.v_user_37 u
JOIN (
    SELECT "#user_id", min("$part_date") AS reg_day
    FROM ta.v_event_37
    WHERE "$part_event" = 'register'
    GROUP BY 1
) r ON u."#user_id" = r."#user_id"
WHERE nullif(u."open_id", '') IS NOT NULL
) u ON e."#user_id" = u."#user_id"
WHERE e."$part_event" IN ('ta_mg_show', 'video_play_start', 'video_play_end', 'ta_mg_hide')
  AND e."$part_date" >= '2025-10-30'
GROUP BY e."$part_date", u."open_id", u.media_name
) player_day
GROUP BY day
) a ON b."日期" = date(a.day)
ORDER BY b."日期" DESC
```

