# 别推我的塔项目口径

status: current
last_verified: 2026-11-17

## 数数项目与支付

- 项目 ID 为 `51`，事件表 `ta.v_event_51`，用户表 `ta.v_user_51`。正式服按 `domain = 'release'`。角色报表的「角色ID」取 `#account_id`；按聚合玩家统计的小时报使用 `nb_open_id`。
- `Register` 为注册创角，`in_out_log` 为登录登出，`pay_log` 为订单完成。现金和代金券由 `payment_method` 的「现金购买」「代金券购买」区分，两类订单的金额均取 `payment`。现金收入、现金付费人数及相关 LTV 筛选「现金购买」，正金额订单用 `payment > 0`。迁移时不沿用「下方了」的 `token_payment` 或金额除以 100 的处理。
- 礼包类型用 `product_type` 单层分组。原商品维表的单价分组用目标实际付费金额 `payment` 替换，并同步替换计算公式和依赖字段。明确标注「含代金券购买」的报表保留两类购买。

## 新增分析的虚拟属性和分层

- `#vp@active_days_create` 为事件日期减创角日期的自然日差，创角当天为 0。原生新增留存的初始事件为 `in_out_log` 且该属性等于 0，回访侧沿用登录登出事件。创角当天付费留存将日期条件设在现金订单的初始事件上。
- `#vp@server_open_days` 为事件日期减开服日期再加 1。开服当天为 1，计算前将 `server_open_time` 从 Unix 时间转换到项目日期。
- 「首日付费分层（创角）」按角色的创角当天现金金额分档。沿用源看板的顺序和边界：`h_(1000+)`、`g_(500,1000]`、`f_(300,500]`、`e_(100,300]`、`d_(30,100]`、`c_(6,30]`、`b_(0,6]`、`a_free`。
- 「角色首次现金付费时间」由角色有效现金订单的最早事件时间产生。「是否首次现金付费日」比较该时间与订单时间的自然日，用于累计付费率。付费渗透留存同时区分历史有现金充值和截至该次事件时已现金付费，后者比较首次现金付费时间与事件时间。

## 服务器生态汇总

- [服务器生态汇总](https://ta-data.feiyu.com/#/tga/event/51_6250?fromPanel=51_2233) 为原生事件分析，保留源报表的 26 项指标。按正式服的服务器 ID 和开服时间分组，角色按 `#account_id` 去重。公会数在 `in_out_log` 上对非零 `clan_uid` 去重。实测同一服务器 ID 可能对应多个开服时间，按两个字段分组时会分行。
- `#vp@cash_payment_amount` 对正金额现金订单返回 `payment`，其他订单返回空。公共指标分别为 `server_active_roles`、`server_cash_paying_roles`、`server_cash_pay_rate`、`server_cash_arpu` 和 `server_cash_arppu`。活跃角色来自登录登出，付费角色来自有效现金订单。
- `#vp@server_open_time_local` 将用户属性 `server_open_time` 的 Unix 秒或毫秒转为北京时间，报表按完整时间分组。`#vp@latest_logout_day_age` 把数值型 `latest_online_time` 转为北京时间后计算自然日差，近三天活跃取日差 0 至 2。
- 「是否滚服」标签 `server_roll_role` 在指定创角范围内按 `nb_open_id` 找最早创角区服，以角色所在区服是否相同判定。有区服但缺少聚合 ID 的角色记为纯新。「首日现金付费角色」分群 `first_day_cash_pay_roles` 匹配创角自然日内有有效现金订单的角色。
- 本次上线的固定起点为 **2026-11-16**。服务器生态报表及首日现金付费分群截至今日，滚服标签以该日限制参与比较的创角记录，`rclass_level_role`、`first_cash_pay_time` 和 `total_cash_payment` 以该日限制事件分区。引用首次付费或历史累充标签的报表时，需按此起点解读标签值。
