# 身份、角色、账号与渠道模型

status: current
effective_date: 2026-10-08
last_verified: 2026-10-08

## 身份层级
- #user_id：数数内部用户 ID，历史用户标签常用。
- #account_id：项目账号分析对象，分群表常转 varchar 后关联 #varchar_id。
- role_id：角色粒度，不等同账号。
- nb_open_id：下方了跨角色/跨渠道唯一玩家主键。
- open_id：平台侧 open_id，不能默认替代 nb_open_id。
- #device_id：设备粒度，仅在有设备埋点的事件可使用。

## 分群
当前分群表：ta.user_result_cluster_xx。
字符串账号关联：
cast(a."#account_id" as varchar)=b."#varchar_id"

## 历史标签
历史标签表：ta.history_tag_xx。
历史用户标签优先：
a."#user_id"=h."#long_id"

## 四类身份必须分开
- 新增：按注册/创角 cohort。
- 滚服：同一玩家是否已有更早角色经历。
- 转端：来源渠道与当前行为渠道发生迁移。
- 合服：服务器/zone/region 结构变化。
四者互不等价，不可互相替代。

## active_channel / event_channel
针对下方了跨渠道分析：
- active_channel：同一 nb_open_id 下最早 create_role_time 对应 channel_id。
- event_channel：当天实际登录/支付事件上报 channel_id。
- 渠道新增：同一 nb_open_id 第一次进入该实际行为渠道的当天。

## ad_platform
媒体平台默认只从用户表取，空值展示“自然量”。
