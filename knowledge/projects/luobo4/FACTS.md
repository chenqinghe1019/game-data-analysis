# 萝卜4小游戏 Canonical Facts

status: current
effective_date: 2026-10-08
last_verified: 2026-10-08

## 基础
- 项目：萝卜4小游戏
- 用户表：ta.v_user_37
- 事件表：ta.v_event_37
- 表后缀：37
- 用户表无 domain/create_role_time。
- 新增默认取 register 事件分区日期 $part_date。

## 原则
- 不能套用下方了/弯月/暴弹的 create_role_time、支付单位或战斗事件。
- 新增、活跃、支付、Applogger 场景应优先读取 luobo4_tracking.yaml 与 applogger_baoweiluobo4_workflow.yaml。
- 测试期与正式期若有独立日期/版本过滤，按专题文件明确规则执行。

## 待持续补齐
Canonical 当前只保存已确认稳定事实。支付单位、渠道映射、核心场景/关卡规则若后续确认，应优先补充本文件。
