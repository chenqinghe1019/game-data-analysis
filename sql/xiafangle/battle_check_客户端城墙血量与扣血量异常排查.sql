-- 下方了 battle_check：客户端城墙血量 vs 城墙扣血量异常排查
-- 目的：检查 HpLost 明显高于 reportHpMax 的对局。
-- 默认“差距巨大”阈值：HpLost / reportHpMax >= 2。
-- 如需改成 3/5/10 倍，只修改最外层倍率条件即可。

SELECT
    cast(e."#account_id" AS varchar) AS "角色ID",
    try_cast(e."region_id" AS bigint) AS "服务器ID",
    round(
        coalesce(
            try_cast(e."total_payment" AS double),
            0
        ) / 100.0,
        2
    ) AS "累充金额",
    cast(e."#event_time" AS timestamp) AS "异常时间",
    try_cast(e."battle_type" AS integer) AS "battle_type",
    try_cast(e."map_id" AS integer) AS "map_id",
    nullif(trim(cast(e."battle_uid" AS varchar)), '') AS "battle_uid",

    try_cast(
        nullif(trim(cast(e."reportHpMax" AS varchar)), '')
        AS double
    ) AS "客户端城墙血量",

    try_cast(
        nullif(trim(cast(e."HpLost" AS varchar)), '')
        AS double
    ) AS "城墙扣血量",

    round(
        try_cast(
            nullif(trim(cast(e."HpLost" AS varchar)), '')
            AS double
        )
        /
        nullif(
            try_cast(
                nullif(trim(cast(e."reportHpMax" AS varchar)), '')
                AS double
            ),
            0
        ),
        4
    ) AS "扣血量/客户端城墙血量",

    round(
        try_cast(
            nullif(trim(cast(e."HpLost" AS varchar)), '')
            AS double
        )
        -
        try_cast(
            nullif(trim(cast(e."reportHpMax" AS varchar)), '')
            AS double
        ),
        2
    ) AS "扣血量超出城墙血量",

    try_cast(
        nullif(trim(cast(e."attackedTimes" AS varchar)), '')
        AS double
    ) AS "城墙受击次数",

    try_cast(
        nullif(trim(cast(e."duration" AS varchar)), '')
        AS double
    ) AS "战斗时长"

FROM ta.v_event_41 e

WHERE e."$part_event" = 'battle_check'
  AND e.${PartDate:date}
  AND coalesce(cast(e."domain" AS varchar), 'release') = 'release'
  AND "#account_id" ${Text:text}
  AND try_cast(e."battle_type" AS integer) <> 8

  AND try_cast(
        nullif(trim(cast(e."reportHpMax" AS varchar)), '')
        AS double
      ) > 0

  AND try_cast(
        nullif(trim(cast(e."HpLost" AS varchar)), '')
        AS double
      ) > 0

  AND try_cast(
        nullif(trim(cast(e."HpLost" AS varchar)), '')
        AS double
      )
      /
      nullif(
          try_cast(
              nullif(trim(cast(e."reportHpMax" AS varchar)), '')
              AS double
          ),
          0
      ) >= 2

ORDER BY
    "扣血量/客户端城墙血量" DESC,
    "异常时间" DESC;
