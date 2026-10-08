# SQL/分析模板索引

status: current
effective_date: 2026-10-08

本目录用于记录“应该复用的分析结构”，实际已验证 SQL 仍优先从仓库 sql/ 搜索。

## 生命周期模板
- 新增 D1-Dn 活跃/留存
- 新增 D1-Dn 付费/付费率/ARPU/ARPPU/LTV
- 当日值 vs 累计值
- 分日独立成熟
- 历史 VIP/标签快照

## 付费模板
- 首日付费分层
- 累计付费分层
- 付费项目 LTV 贡献
- 首付项目 → 后续留存/复购
- order_id 重复核查
- product_id/product_name 维表未匹配核查

## 战斗模板
- 关卡挑战/通关人数与次数
- 人数通关率/次数通过率
- 上层→本层转化
- 停留关卡
- 跳关识别
- 英雄上阵率：#account_id + battle_uid 联合去重

## 战力模板
- 新增第 N 天当天最高
- 截止第 N 天最高
- P0/P25/P50/P75/P90/P95/P99
- P99×N 异常玩家排查
- 按 VIP/R档/活跃天数拆分

## 渠道模板
- active_channel / event_channel
- 渠道新增
- 端包/转端用户
- 转端流水 0.4 折算
- 渠道 DAU/新增/流水/占比

## 服务器模板
- 区服三日画像
- 强弱服 LTV 倍率
- 合服前7日/后7日
- zone_id→region_id 范围
