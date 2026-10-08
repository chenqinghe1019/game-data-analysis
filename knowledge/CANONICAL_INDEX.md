# 倍特工作室 Canonical Knowledge Index

status: current
effective_date: 2026-10-08
last_verified: 2026-10-08

本目录是倍特工作室知识库的 Canonical 层。后续处理 SQL、数据分析、埋点、看板、排查、项目规则时，优先读取本文件，再读取对应 Canonical 文档。

## 读取优先级
1. 当前用户明确指令
2. 本文件
3. knowledge/global/*
4. knowledge/projects/<项目>/*
5. 对应 tracking YAML
6. memory/projects/ 中最新专题规则
7. sql/ 中最新已验证 SQL
8. 历史 knowledge/、weekly_notes/、analysis 资料

## 全局 Canonical
- global/metric_definitions.md：统一指标字典
- global/sql_rules.md：SQL 编写/参数/输出规范
- global/lifecycle_maturity.md：D1-Dn、成熟、历史快照
- global/identity_channel.md：账号/角色/设备/渠道身份
- global/payment_policy.md：支付金额、首日/累计付费、代币与去重
- global/data_quality_playbook.md：异常排查手册
- global/field_pitfalls.md：字段/事件/类型易错清单
- global/analysis_method.md：统一分析方法

## 项目 Canonical
- projects/xiafangle/FACTS.md
- projects/wanyue/FACTS.md
- projects/bubu/FACTS.md
- projects/baodanfeshe/FACTS.md
- projects/luobo4/FACTS.md

## 版本规则
- Canonical 文件只保存“当前有效且可复用”的事实/规则。
- 一次性版本结论、阶段性分析结论不得写入 Canonical。
- 旧规则保留但必须标记 historical / superseded。
- 新规则若替代旧规则，应在新文件写明 supersedes。
- 字段、金额单位、表后缀、关联键、分子分母等变化，必须优先更新 Canonical。

## 维护原则
任何长期有效的新口径，在用户确认后应同步到本层或对应项目专题文件；若影响跨项目，则同时更新本索引或 global 文档。
