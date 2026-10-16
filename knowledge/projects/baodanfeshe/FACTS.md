# 暴弹飞射 Canonical Facts

status: current
effective_date: 2026-10-08
last_verified: 2026-10-16

## 基础
- 项目：暴弹飞射
- 用户表：ta.v_user_42
- 事件表：ta.v_event_42
- 表后缀：42
- 正式环境：domain='release'
- payment：pay_log.payment，单位元，直接使用，禁止 /100。

## 活跃与在线
- 活跃事件：in_out_log。
- 在线时长：ta_app_end.#duration。
- #duration 单位秒，转分钟除以60。
- 在线时长不能用 in_out_log.online_time 代替。
- 过滤明显异常全天值/超过24h数据时按专题规则执行。

## 战斗
- 战斗开始：battle_start。
- 主线/玩法 battle_type 按项目 tracking 定义。
- battle_type=21 已用于新增后 D1-D7 玩法参与专题。
- 阵容/战斗场次去重时，battle_uid 应与 #account_id 联合使用。

## 支付/分层
- 累计付费分层与首日付费分层必须区分。
- 代币充值、代币消耗、现金支付按专题明确逻辑处理，不能跨项目套用下方了 payment/token_payment 规则。

## 战力
- 战力分析需明确：当天最高 / 截止当天最高 / 最终值。
- 生命周期战力可按累计付费、活跃天数等维度拆分。

## 战斗字段真实类型与提取方法（2026-10-16 排查结果）
- 来源：用户在数数 Trino 查询 ta.v_event_42 中 battle_start、battle_result、rougue_skill_show、rougue_skill 事件，返回的 30 行样本 CSV；类型经 typeof() 确认，技能数组本批样本未取到非空值。
- battle_array：array(varchar)，数组元素是 **JSON 对象字符串**，不是 array(row)。展示整列用 `json_format(CAST("battle_array" AS JSON))`，不可 `CAST("battle_array" AS VARCHAR)`；解析单个英雄先 `CROSS JOIN UNNEST("battle_array") AS t(hero_json)`，再 `json_extract_scalar(TRY(json_parse(hero_json)), '$.hero_id')` 等；需要数值时 TRY_CAST(... AS DOUBLE/BIGINT)。
- battle_array 的 battle_start 样例包含 hero_id、hero_name、hero_star、hero_level、hero_power；battle_result 样例还包含 hero_hurt、hero_atk。具体字段以单条 JSON 实际存在情况为准。
- skill_options、skill_chosen：array(row(skill_content varchar, hero_name varchar, skill_name varchar, skill_id double, hero_id double))；展示整体 `json_format(CAST("skill_options" AS JSON))` / `json_format(CAST("skill_chosen" AS JSON))`；展开用 `CROSS JOIN UNNEST("skill_options") AS t(skill)` 后读取 `skill.skill_id`、`skill.hero_id`、`skill.skill_name` 等；排查样本中这两列的样例均为空，以上展开方式基于 typeof 字段结构，需在非空记录验证。
- battle_uid、battle_type、map_id、battle_time：double；battle_result、autoBattle：varchar。battle_uid 参与连接时优先同类型直接比较，必要时统一 TRY_CAST，且必须联合 #account_id；避免一侧 varchar 一侧 double 的隐式不匹配。
- 数组字段排查模板：`SELECT typeof("battle_array"), json_format(CAST("battle_array" AS JSON)) FROM ta.v_event_42 WHERE "domain"='release' AND "$part_event"='battle_result' AND "battle_array" IS NOT NULL LIMIT 10`。
- 类型由实际 Trino 返回确定；不能把其它项目的阵容或技能 JSON 提取规则直接迁移。
