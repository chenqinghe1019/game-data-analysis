# 暴弹飞射 Canonical Facts

status: current
effective_date: 2026-10-08
last_verified: 2026-10-08

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
