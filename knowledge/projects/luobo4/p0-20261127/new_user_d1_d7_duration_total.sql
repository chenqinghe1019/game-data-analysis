-- 新增按全历史register最早日期；D1为注册当天，统计至昨日。
-- 保留现有时长SQL的CTE结构，先压到用户日，避免重复JOIN。
WITH reg AS (
    SELECT "#user_id",min("$part_date") AS reg_day
    FROM ta.v_event_37
    WHERE "$part_event"='register' AND "#user_id" IS NOT NULL
    GROUP BY 1
), cohort AS (
    SELECT "#user_id",reg_day,media_name
    FROM (
      SELECT r."#user_id",r.reg_day,r.reg_day AS "$part_date",
             coalesce(nullif(trim(u.media_name),''),'自然量') AS media_name
      FROM reg r LEFT JOIN (
        SELECT "#user_id",max(ad_platform) AS media_name
        FROM ta.v_user_37 GROUP BY 1
      ) u ON r."#user_id"=u."#user_id"
    ) c
    WHERE ${PartDate:date1} AND ${Selector:media}
      AND date(reg_day)<current_date
), daily AS (
    SELECT "$part_date" AS day,"#user_id",
           max(CASE WHEN "$part_event"='ta_mg_show' THEN 1 ELSE 0 END) AS active,
           sum(CASE WHEN "$part_event"='ta_mg_hide' AND "#duration">=0 AND "#duration"<86400
                    THEN "#duration" ELSE 0 END) AS seconds
    FROM ta.v_event_37
    WHERE "$part_event" IN ('ta_mg_show','ta_mg_hide')
      AND "$part_date">=(SELECT min(reg_day) FROM cohort)
      AND "$part_date"<=cast(least(
            date_add('day',6,(SELECT max(date(reg_day)) FROM cohort)),
            date_add('day',-1,current_date)) AS varchar)
      AND "#user_id" IN (SELECT "#user_id" FROM cohort)
    GROUP BY 1,2
)
SELECT date(c.reg_day) AS "新增日期",
       count(DISTINCT c."#user_id") AS "新增人数",
       round(sum(CASE WHEN date_diff('day',date(c.reg_day),date(d.day))=0 AND d.active=1 THEN coalesce(d.seconds,0) ELSE 0 END)
             /nullif(count(DISTINCT CASE WHEN date_diff('day',date(c.reg_day),date(d.day))=0 AND d.active=1 THEN c."#user_id" END),0)/60.0,2)
             AS "D1人均在线时长（分钟）",
       round(sum(CASE WHEN date_diff('day',date(c.reg_day),date(d.day))=1 AND d.active=1 THEN coalesce(d.seconds,0) ELSE 0 END)
             /nullif(count(DISTINCT CASE WHEN date_diff('day',date(c.reg_day),date(d.day))=1 AND d.active=1 THEN c."#user_id" END),0)/60.0,2)
             AS "D2人均在线时长（分钟）",
       round(sum(CASE WHEN date_diff('day',date(c.reg_day),date(d.day))=2 AND d.active=1 THEN coalesce(d.seconds,0) ELSE 0 END)
             /nullif(count(DISTINCT CASE WHEN date_diff('day',date(c.reg_day),date(d.day))=2 AND d.active=1 THEN c."#user_id" END),0)/60.0,2)
             AS "D3人均在线时长（分钟）",
       round(sum(CASE WHEN date_diff('day',date(c.reg_day),date(d.day))=3 AND d.active=1 THEN coalesce(d.seconds,0) ELSE 0 END)
             /nullif(count(DISTINCT CASE WHEN date_diff('day',date(c.reg_day),date(d.day))=3 AND d.active=1 THEN c."#user_id" END),0)/60.0,2)
             AS "D4人均在线时长（分钟）",
       round(sum(CASE WHEN date_diff('day',date(c.reg_day),date(d.day))=4 AND d.active=1 THEN coalesce(d.seconds,0) ELSE 0 END)
             /nullif(count(DISTINCT CASE WHEN date_diff('day',date(c.reg_day),date(d.day))=4 AND d.active=1 THEN c."#user_id" END),0)/60.0,2)
             AS "D5人均在线时长（分钟）",
       round(sum(CASE WHEN date_diff('day',date(c.reg_day),date(d.day))=5 AND d.active=1 THEN coalesce(d.seconds,0) ELSE 0 END)
             /nullif(count(DISTINCT CASE WHEN date_diff('day',date(c.reg_day),date(d.day))=5 AND d.active=1 THEN c."#user_id" END),0)/60.0,2)
             AS "D6人均在线时长（分钟）",
       round(sum(CASE WHEN date_diff('day',date(c.reg_day),date(d.day))=6 AND d.active=1 THEN coalesce(d.seconds,0) ELSE 0 END)
             /nullif(count(DISTINCT CASE WHEN date_diff('day',date(c.reg_day),date(d.day))=6 AND d.active=1 THEN c."#user_id" END),0)/60.0,2)
             AS "D7人均在线时长（分钟）"
FROM cohort c LEFT JOIN daily d
  ON c."#user_id"=d."#user_id"
 AND date(d.day) BETWEEN date(c.reg_day) AND date_add('day',6,date(c.reg_day))
GROUP BY c.reg_day
ORDER BY c.reg_day DESC
