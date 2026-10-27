# 下方了 battle_check：受击、扣血、护盾与治疗字段（2026-10-27）

数据源：`ta.v_event_41`，事件：`battle_check`，建议限制 `domain='release'`；按 `#account_id + battle_uid` 标识战局，历史反外挂排查默认排除 `battle_type=8`。

新增字段（字段名大小写保留）：
- `hpLost`：城墙扣血量。历史 SQL 使用 `HpLost`，在 SQL 引擎大小写不敏感的情况下等价；如 schema 对大小写敏感需以实际列名为准。
- `shieldHpLost`：护盾扣血量。
- `shieldHp`：生成护盾量，**不是已承受护盾伤害**，因此不能将其计入伤害。
- `attackedTimes`：受击次数。
- `HealHp`：回血量。

重点排查：`attackedTimes > 0 AND hpLost = 0 AND shieldHpLost = 0`，明确“不论有无护盾，城墙与护盾均未扣血”；盾生成和回血只作辅助证据。NULL 不按 0 处理，额外识别缺失字段。另区分有城墙扣血、仅护盾扣血、有受击但无扣血、无受击但有扣血。统计粒度优先为 battle_uid；重复上报应去重并留最后一条，避免分母被放大。

说明：该条件为**可疑现象，不直接证明作弊**；受击次数可能包含闪避、免疫、无敌、未命中、伤害抵消等，需要开发确认字段上报语义。仅根据事件无法判断每次单次受击是否造成伤害，判断的是一场战斗整体受击次数与累计扣血的对应关系。

排查 SQL：`sql/xiafangle/battle_check_受击零伤害排查_20261027.sql`。
