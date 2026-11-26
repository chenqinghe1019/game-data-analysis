-- 弯月勇者：按战斗发生时累计现金充值分层；继承源报表P99及5/10/20倍分级。
WITH battle_base AS (
    SELECT cast("#account_id" AS varchar) AS role_id,
           try_cast(region_id AS bigint) AS server_id,
           cast("#event_time" AS timestamp) AS battle_time,
           try_cast(map_id AS bigint) AS map_id,
           nullif(trim(cast(battle_uid AS varchar)), '') AS battle_uid,
           reduce(battle_array, cast(0 AS double),
             (s,x) -> s + coalesce(try_cast(try(json_extract_scalar(x,'$.damage')) AS double),0),
             s -> s) AS total_damage
    FROM ta.v_event_44
    WHERE "$part_event"='battle_check'
      AND ${PartDate:date1}
      AND domain='release'
      AND try_cast(battle_type AS integer)=20
      AND try_cast(map_id AS bigint)>0
      AND "#account_id" IS NOT NULL
      AND cardinality(battle_array)>0
      -- 无法解析的伤害不作为0混入基准。
      AND cardinality(filter(battle_array,x -> try_cast(try(json_extract_scalar(x,'$.damage')) AS double) IS NULL))=0
), battle_dedup AS (
    SELECT role_id,server_id,battle_time,map_id,battle_uid,total_damage
    FROM (
      SELECT b.*,row_number() OVER (
        PARTITION BY role_id,server_id,map_id,coalesce(battle_uid,cast(battle_time AS varchar))
        ORDER BY battle_time DESC) AS rn
      FROM battle_base b
    ) t WHERE rn=1 AND total_damage>=0
), payment_by_time AS (
    SELECT cast("#account_id" AS varchar) AS role_id,
           cast("#event_time" AS timestamp) AS event_time,
           sum(try_cast(payment AS double)) AS payment_fen
    FROM ta.v_event_44
    WHERE "$part_event"='pay_log'
      -- 历史现金充值不套用战斗日期下限。
      AND "$part_date" <= cast((SELECT max(date(battle_time)) FROM battle_dedup) AS varchar)
      AND domain='release' AND change_reason='rmb充值' AND pay_result=1
      AND try_cast(payment AS double)>0
      AND "#event_time" IS NOT NULL
      AND cast("#account_id" AS varchar) IN (SELECT role_id FROM battle_dedup)
    GROUP BY 1,2
), timeline AS (
    SELECT role_id,battle_time AS event_time,1 AS event_kind,server_id,map_id,battle_uid,total_damage,cast(0 AS double) AS payment_fen
    FROM battle_dedup
    UNION ALL
    SELECT role_id,event_time,0 AS event_kind,cast(NULL AS bigint),cast(NULL AS bigint),cast(NULL AS varchar),cast(NULL AS double),payment_fen
    FROM payment_by_time
), battle_pay AS (
    SELECT role_id,server_id,event_time AS battle_time,map_id,battle_uid,total_damage,cumulative_pay,
       CASE WHEN cumulative_pay=0 THEN 'a_free'
            WHEN cumulative_pay<=6 THEN 'b_(0,6]'
            WHEN cumulative_pay<=30 THEN 'c_(6,30]'
            WHEN cumulative_pay<=100 THEN 'd_(30,100]'
            WHEN cumulative_pay<=300 THEN 'e_(100,300]'
            WHEN cumulative_pay<=500 THEN 'f_(300,500]'
            WHEN cumulative_pay<=1000 THEN 'g_(500,1000]'
            ELSE 'h_(1000,+)' END AS pay_group
    FROM (
      SELECT t.*,sum(payment_fen) OVER (
        PARTITION BY role_id ORDER BY event_time,event_kind
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)/100.0 AS cumulative_pay
      FROM timeline t
    ) p WHERE event_kind=1
), map_stats AS (
    SELECT map_id,count(*) AS sample_count,approx_percentile(total_damage,0.99) AS p99_damage
    FROM battle_pay GROUP BY map_id
), pay_stats AS (
    SELECT map_id,pay_group,count(*) AS sample_count,approx_percentile(total_damage,0.99) AS p99_damage
    FROM battle_pay GROUP BY map_id,pay_group
), battle_scored AS (
    SELECT b.*,
      CASE WHEN p.sample_count>=1000 AND p.p99_damage>0 THEN p.p99_damage ELSE m.p99_damage END AS p99_reference,
      CASE WHEN p.sample_count>=1000 AND p.p99_damage>0 THEN p.sample_count ELSE m.sample_count END AS reference_sample_count,
      CASE WHEN p.sample_count>=1000 AND p.p99_damage>0 THEN '同关卡同累计付费层' ELSE '同关卡全服' END AS reference_type
    FROM battle_pay b
    LEFT JOIN map_stats m ON b.map_id=m.map_id
    LEFT JOIN pay_stats p ON b.map_id=p.map_id AND b.pay_group=p.pay_group
), battle_ratio AS (
    SELECT s.*,total_damage/nullif(p99_reference,0) AS damage_ratio
    FROM battle_scored s
), player_repeat AS (
    SELECT role_id,count(DISTINCT CASE WHEN damage_ratio>5 THEN map_id END) AS abnormal_map_count,
           count_if(damage_ratio>5) AS abnormal_battle_count
    FROM battle_ratio GROUP BY role_id
), risk_detail AS (
    SELECT b.*,p.abnormal_map_count,p.abnormal_battle_count,
      CASE WHEN damage_ratio>20 THEN 'S1_极高风险'
           WHEN damage_ratio>10 THEN 'S2_高风险'
           WHEN damage_ratio>5 AND p.abnormal_map_count>=2 THEN 'S3_多关卡异常'
           WHEN damage_ratio>5 THEN 'S4_观察' ELSE '正常' END AS risk_level
    FROM battle_ratio b LEFT JOIN player_repeat p ON b.role_id=p.role_id
)
SELECT role_id AS "角色ID",server_id AS "服务器ID",
       round(cumulative_pay,2) AS "战斗时累计现金充值（元）",pay_group AS "累计付费分层",
       battle_time AS "战斗时间",map_id AS "主线关卡ID",battle_uid AS "battle_uid",
       round(total_damage,2) AS "整场总伤害",round(p99_reference,2) AS "关卡P99基准",
       round(damage_ratio,2) AS "伤害/P99倍率",reference_type AS "基准来源",
       reference_sample_count AS "基准样本数",abnormal_map_count AS "超5倍关卡数",
       abnormal_battle_count AS "超5倍战斗数",risk_level AS "伤害异常等级"
FROM risk_detail WHERE risk_level<>'正常'
ORDER BY damage_ratio DESC,battle_time DESC