-- 下方了：battle_check 受击但城墙和护盾均未扣血排查
-- 粒度：角色ID + battle_uid，保留最后一条上报；空 battle_uid 使用事件时间避免错误合并
-- 查询日期在数数中配置 ${PartDate:date}；玩家过滤沿用 ${Text:text}
WITH raw AS (
    SELECT
        CAST(e."#account_id" AS varchar) AS role_id,
        TRY_CAST(e."region_id" AS bigint) AS server_id,
        CAST(e."#event_time" AS timestamp) AS event_time,
        CAST(e."$part_date" AS varchar) AS part_date,
        NULLIF(TRIM(CAST(e."battle_uid" AS varchar)), '') AS battle_uid,
        TRY_CAST(e."battle_type" AS integer) AS battle_type,
        TRY_CAST(e."map_id" AS bigint) AS map_id,
        TRY_CAST(NULLIF(TRIM(CAST(e."hpLost" AS varchar)), '') AS double) AS hp_lost,
        TRY_CAST(NULLIF(TRIM(CAST(e."shieldHpLost" AS varchar)), '') AS double) AS shield_hp_lost,
        TRY_CAST(NULLIF(TRIM(CAST(e."shieldHp" AS varchar)), '') AS double) AS shield_hp,
        TRY_CAST(NULLIF(TRIM(CAST(e."attackedTimes" AS varchar)), '') AS double) AS attacked_times,
        TRY_CAST(NULLIF(TRIM(CAST(e."HealHp" AS varchar)), '') AS double) AS heal_hp,
        TRY_CAST(NULLIF(TRIM(CAST(e."duration" AS varchar)), '') AS double) AS duration,
        COALESCE(TRY_CAST(e."total_payment" AS double), 0) / 100.0 AS total_payment_rmb
    FROM ta.v_event_41 e
    WHERE e."$part_event" = 'battle_check'
      AND e.${PartDate:date}
      AND COALESCE(CAST(e."domain" AS varchar), 'release') = 'release'
      AND e."#account_id" ${Text:text}
      AND TRY_CAST(e."battle_type" AS integer) <> 8
),
dedup AS (
    SELECT *, ROW_NUMBER() OVER (
        PARTITION BY role_id,
                     CASE WHEN battle_uid IS NOT NULL THEN battle_uid
                          ELSE CONCAT('missing_uid_', CAST(event_time AS varchar), '_', CAST(map_id AS varchar))
                     END
        ORDER BY event_time DESC
    ) AS rn
    FROM raw
),
classified AS (
    SELECT *,
       CASE
          WHEN attacked_times IS NULL OR hp_lost IS NULL OR shield_hp_lost IS NULL THEN '字段缺失_待核实'
          WHEN attacked_times > 0 AND hp_lost = 0 AND shield_hp_lost = 0 THEN '受击但城墙护盾均未扣血'
          WHEN attacked_times > 0 AND hp_lost = 0 AND shield_hp_lost > 0 THEN '受击仅护盾扣血'
          WHEN attacked_times > 0 AND hp_lost > 0 THEN '受击城墙扣血'
          WHEN attacked_times = 0 AND (hp_lost > 0 OR shield_hp_lost > 0) THEN '未受击但有扣血'
          WHEN attacked_times = 0 AND hp_lost = 0 AND shield_hp_lost = 0 THEN '未受击且无扣血'
          ELSE '其他_异常数值'
       END AS scenario
    FROM dedup
    WHERE rn = 1
)
 , metrics AS (
SELECT
    part_date AS "日期",
    role_id AS "角色ID",
    server_id AS "区服ID",
    ROUND(total_payment_rmb, 2) AS "累充金额",
    event_time AS "事件时间",
    battle_uid AS "battle_uid",
    battle_type AS "战斗类型",
    map_id AS "关卡ID",
    attacked_times AS "受击次数",
    hp_lost AS "城墙扣血量",
    shield_hp_lost AS "护盾扣血量",
    shield_hp AS "生成护盾量",
    heal_hp AS "回血量",
    duration AS "战斗时长秒",
    scenario AS "受击扣血分类",
    COUNT(*) OVER (PARTITION BY battle_type) AS "该战斗类型总对局数",
    COUNT_IF(scenario = '受击但城墙护盾均未扣血') OVER (PARTITION BY battle_type) AS "该类型零伤害受击对局数",
    ROUND(
      COUNT_IF(scenario = '受击但城墙护盾均未扣血') OVER (PARTITION BY battle_type) * 1.0000
      / NULLIF(COUNT(*) OVER (PARTITION BY battle_type), 0), 4
    ) AS "该类型零伤害受击对局占比"
FROM classified
)
SELECT * FROM metrics
-- 若要检查全部类型以及缺失值，注释下一行
WHERE "受击扣血分类" = '受击但城墙护盾均未扣血'
ORDER BY "事件时间" DESC, "角色ID", "battle_uid";
