SELECT
    role_id AS "角色ID",
    server_id AS "服务器ID",
    abnormal_time AS "异常时间",
    array_join(filter(ARRAY[
        CASE WHEN refresh_card > 2 THEN '对局内刷卡次数修改' END,
        CASE WHEN battle_type = 20 AND duration < 100 THEN '通关时间异常' END
    ], x -> x IS NOT NULL), '、') AS "异常情况",
    refresh_card AS "修改刷卡次数",
    report_hp_max AS "客户端城墙血量",
    svr_hp_max AS "服务端城墙血量",
    round(duration, 2) AS "实际通关时间（秒）",
    100.0 AS "通关时间异常阈值（秒）",
    battle_uid AS "异常battle_uid",
    battle_type AS "battle_type",
    map_id AS "map_id"
FROM (
    SELECT cast("#account_id" AS varchar) AS role_id,
           try_cast(region_id AS bigint) AS server_id,
           cast("#event_time" AS timestamp) AS abnormal_time,
           nullif(trim(cast(battle_uid AS varchar)), '') AS battle_uid,
           try_cast(battle_type AS integer) AS battle_type,
           try_cast(map_id AS integer) AS map_id,
           try_cast(duration AS double) AS duration,
           try_cast("refreshCard" AS double) AS refresh_card,
           try_cast("reportHpMax" AS double) AS report_hp_max,
           try_cast("svrHpMax" AS double) AS svr_hp_max
    FROM ta.v_event_44
    WHERE "$part_event" = 'battle_check'
      AND ${PartDate:date}
      AND domain = 'release'
      AND "#account_id" ${Text:text}
      AND try_cast(map_id AS integer) > 10
) t
WHERE refresh_card > 2
   OR (battle_type = 20 AND duration < 100)
ORDER BY abnormal_time DESC, role_id, battle_uid