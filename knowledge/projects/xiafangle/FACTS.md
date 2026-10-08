# 下方了 Canonical Facts

status: current
effective_date: 2026-10-08
last_verified: 2026-10-08

## 基础
- 项目：下方了
- 用户表：ta.v_user_41
- 事件表：ta.v_event_41
- 表后缀：41
- 正式环境：domain='release'
- create_role_time：timestamp，直接使用
- 活跃事件：in_out_log
- 跨渠道唯一玩家：nb_open_id
- payment：pay_log.payment，单位分，/100 转元

## 主线
- battle_type=1
- 开始事件：battle_star
- 结算事件：battle_result
- 正常通关：result=1 且 duration<>0；duration IS NULL 也按正常通关
- 跳关：result=2，或 result=1 且 duration=0
- 合作试炼：battle_type=8
- 海岛/海盗探险：battle_type=3

## 首日付费分层
- a_free = 0
- b = (0,6]
- c = (6,30]
- d = (30,100]
- e = (100,300]
- f = (300,500]
- g = (500,1000]
- h = >1000

## 渠道
当前后台渠道：
- 3056210 TapTap
- 3056211 微信小游戏
- 3056214 抖音小游戏
- 3056215 官方Apple渠道
- 3056218 主播直播体验包
- 3056219 抖音直播投放包
- 3056220 支付宝小游戏
- 3056221 好游快爆
- 3056222 官方Android渠道

指定微信转端报表端包池：3056210 / 3056215 / 3056219。
active_channel=3056211 且后续进入端包池 → 转端用户。
active_channel 本身在端包池且行为渠道在端包池 → 端包用户。
流水类转端用户按 0.4 折算；汇总=端包原值+转端×0.4；人数不折算。

## 流失/大R
- 流失：距今 >=3 天未登录。
- 介入门槛：总付费 >=5000。
- 大R专题：累充 >=100000。

## 合服
- zone_id 在玩家事件中首次出现日期定义合服起始日。
- 区服范围按 zone_id 升序切分。
- 最后一个 zone 上限取合服后7日活跃玩家最大 region_id。
- 合服后7日包含合服当天。
- 合服前/后 LTV 贡献使用对应新增人数作为分母。
- 需要包含未成熟样本的合服专题，以专题明确规则为准。

## 矿脉
- mining_log 任意记录：矿脉参与。
- change_reason=1：占领参与。
- change_reason=3：掠夺参与。
- season 取周期内最后一次 in_out_log 非空公共属性；1=S1，2=S2。
- 人均占领次数=占领总次数/占领参与人数。
- 人均抢夺次数=抢夺总次数/抢夺参与人数。

## 关联
- 当前分群：ta.user_result_cluster_41，#account_id 转 varchar 关联 #varchar_id。
- 历史标签：ta.history_tag_41，用户标签 #user_id -> #long_id。
