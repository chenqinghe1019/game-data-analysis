# 字段、事件与类型易错清单

status: current
effective_date: 2026-10-08
last_verified: 2026-10-08

## 高频易错
- 下方了主线开始：battle_star，不是 battle_start。
- 暴弹飞射战斗开始：battle_start。
- 下方了 v41，弯月勇者 v44，步步 v22，暴弹飞射 v42，萝卜4 v37。
- 下方了 payment /100；暴弹 payment 不 /100。
- create_role_time 在不同项目历史数据中类型不完全一致，写 SQL 前确认 timestamp / Unix 秒。
- history_tag.$tag_date 为 integer YYYYMMDD，不是 date。
- 历史用户标签用 #user_id -> #long_id；当前字符串分群通常用 #account_id -> #varchar_id。
- ad_platform 默认只从用户表取。
- 文本缺失统一“未获取”，不要混用“未知”“未填写”。
- COALESCE 不能混 varchar 与 integer。
- role_id 不等于英雄名/英雄ID。
- battle_uid 需要与账号联合去重时，使用 #account_id + battle_uid。
- 在线时长需按项目指定事件；不能跨项目默认使用同一字段。
- invite_log.success 的业务含义按项目已确认规则使用，不按字段名直觉解释。
- 生命周期 cohort 日期参数不能截断后续事件窗口。

## 需要先核查再写
- 支付单位
- 时间字段类型
- 商品维表匹配键
- JSON/varchar 数组字段结构
- 事件公共属性 season/channel_id 是否确实存在于当前表
