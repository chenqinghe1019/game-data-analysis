# 弯月勇者 Canonical Facts

status: current
effective_date: 2026-10-08
last_verified: 2026-10-08

## 基础
- [外挂治理看板与现金累充分层](ANTI_CHEAT.md)：2026-11-26已核对项目44的主线20、JSON伤害数组、现金充值分转元及战斗时累计分层；不沿用项目41的监测字段。
- 项目：弯月勇者
- 用户表：ta.v_user_44
- 事件表：ta.v_event_44
- 表后缀：44
- 旧 v46 记录属于历史口径，不作为当前默认。
- payment 单位未在当前 Canonical 中统一验证时，不自行 /100。

## 主线关卡统计（2026-11-26 用户提供 SQL）
- 标准参考原文：[前7日主线关卡、首日付费分层 SQL](../../../sql/wanyue_mainline_stage_first_day_pay_d7_v44_20261126.sql)。来源：2026-11-26 用户上传的 370 行 SQL；用户要求作为后续主线分析参考，已归档原文。本节优先于历史文档中与之冲突的 battle_result 数值枚举和单一开始事件口径。
- 新增：本参考报表按正式服角色 `#account_id`，`ta.v_user_44.domain='release'`，`DATE(FROM_UNIXTIME(TRY_CAST(create_role_time AS double)))` 为创角日，先构造 `"$part_date"` 再用 `${PartDate:date1}` 圈选。事件按角色关联，不额外要求事件表 domain。本角色维度是该报表口径；跨账号专题仍按各自明确的 nb_open_id 规则。
- 主线：`TRY_CAST(battle_type AS bigint)=20`；关卡用数值 `TRY_CAST(map_id AS bigint)`；开始事件同时纳入 `battle_star`、`battle_start`，结算事件 `battle_result`。不把下方了的主线类型 1 套用到弯月。
- 结算枚举取 `LOWER(TRIM(CAST(battle_result AS varchar)))`：`win` 为正常通关，`2` 为跳关；总通关包含两者，每场至多计一次。旧文档的 `battle_result=1` 不作为正常通关的默认条件；本 SQL 未确认失败、退出的全部枚举，不自行推断。
- 战斗粒度：新增日、角色、关卡、battle_uid；同一战斗合并开始与结算，任一存在即为挑战。空 uid 回退 `CONCAT('__missing__',CAST(event_time AS varchar),'_',event_name)`；回退仅防止缺失 uid 的不同记录被合并，不能可靠串联开始和结算。战斗发生时间取 `MIN(event_time)`，按时间、battle_key 排序得到关卡挑战顺序。
- 首次挑战通关：第一场挑战正常通关或跳关；人数通关：至少一场正常通关或跳关；跳关人数为至少一场跳关；重复2/3次挑战人数分别为挑战次数>=2/>=3。首次正常通关战力取正常通关结算 `fighting_power`（同一 battle_uid 取 MAX），再按战斗发生时间 MIN_BY；不取跳关战力。P0/P25/P50/P75/P100 仅有非空首次正常通关战力的样本。
- 首日付费：角色创角日正向 `pay_log.payment/100`，未额外限制 pay_result，不含 token_payment。分层 0、(0,6]、(6,30]、(30,100]、(100,300]、(300,500]、(500,1000]、>1000。
- 生命周期窗口：创角日到创角后6日，事件日期早于 CURRENT_DATE。原参考 SQL 未限制新增 cohort 必须满7日；如分析要求完整 D7 成熟样本，额外使用 `DATE_ADD('day',6,new_date)<CURRENT_DATE`，不能把原参考称为已完整成熟。
- 战斗耗时：原 SQL 的 `MIN(event_time) AS battle_time` 是发生时间别名，不是结算事件实际耗时字段。该 SQL 未验证 `battle_result.battle_time` 的实际含义/单位；时长专题需独立核对，或明确使用同场开始至结算的自然经过秒数，两者不混用。
- 关卡映射：历史实测 10001～10004 对应1-1～1-4；本参考 SQL 直接输出原 map_id，未确认后续章节跨项目映射。不要用关卡数值相减或按序号强行映射未知章节。
- 状态：用户提供的参考 SQL 已归档，未由当前会话在数数平台重新执行。

## 双人合作 AppLogger
核心场景：
- scene_newcooperation_level
- scene_newcooperation_home
- scene_daily
- scene_starway

测试期：
- S1：2026-02-12 起两周
- S2：2026-07-30 起两周

端：汇总 / 安卓 / iOS / 鸿蒙。

## Level
状态：
- 0 失败
- 1 通过
- 2 完美通关

通关率=(状态1+状态2启动次数)/总启动次数。
参与率分母=scene_newcooperation_home 活跃人数。

## 计费点
2026-07-30~2026-08-12 重点合并：
- 10/-10 体力
- 60/-60 分钟无限体力
- 60/-60 宝石
- 350/-350 宝石
- 星途礼包 3101+3201 合并
- 双人合作：远航礼包/双帆远航通行证/合作挑战票

## 在线/异常
- 首日付费前后时长需剔除 >24h。
- 生命周期前期战力分析按 D1-D3 等明确目标日口径。
- 英雄星级缺失需结合 hero_get_log / star_up 等真实事件补齐，不能只用当前星级覆盖历史。

## 抽卡达标
已使用的阈值组：
- 120/400/800/1300/1850/2400/3000
- 400/410/810/1310/1860/2410/3010/510/610/710/910/1010/1110/1210

## 原则
弯月勇者 SQL 不得套用下方了 v41 的支付单位、battle_type 或渠道配置。
