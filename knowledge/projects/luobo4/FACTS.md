# 萝卜4小游戏 Canonical Facts

status: current
effective_date: 2026-10-08
last_verified: 2026-11-27

## 基础
- [2026-11-27 P0付费与新增时长看板](P0_DASHBOARDS.md)：项目空间内2262/2263，报表6351—6355，首充历史关卡、前7日购买路径、每日商品明细及新增D1-D7在线时长；包含本轮用户确认的分母和归因规则。
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

## 大盘广告与时长补充（2026-11-19）

- 看板37_1017的分媒体大盘3513、汇总大盘3846已增加14列广告和在线时长指标。完整实现见 [SQL](../../../sql/luobo4/overview_ad_duration_20261119.md)。
- 用户明确选择保留原DAU、新增和付费口径。原DAU来自register/guide_complete/login，原新增使用用户first_login_time/1000。此要求优先于统一改写这些基础字段。
- 仅补充字段参照广告5654、在线时长5664。观看=video_play_start，完播=video_play_end，活跃=ta_mg_show，新增=register最早分区日期，人数适配本大盘open_id身份。
- 人均观看次数=观看次数/观看人数，人均完播次数=完播次数/完播人数，完播率=完播次数/观看次数，广告渗透率=观看人数/参考活跃人数。新增首日按register日限定，渗透率分母为该日新增参考活跃人数。原DAU/新增人数与补充字段分母可能不同。
- 活跃人均时长及新增首日人均时长均取对应ta_mg_show活跃玩家的ta_mg_hide.#duration总和除以对应人数，再换算分钟。沿用参考报表单条#duration<86400秒，缺失记录不估算。无分母为NULL。
- 先独立聚合广告和时长，再关联原大盘结果，避免订单JOIN倍增。原媒体ad_platform分组保留，NULL用IS NOT DISTINCT FROM关联。比率0–1保留四位，人均保留两位。
