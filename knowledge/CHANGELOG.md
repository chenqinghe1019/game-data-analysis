# Knowledge Changelog

## 2026-10-08 — Canonical 知识库重构

### 新增
- knowledge/CANONICAL_INDEX.md
- knowledge/global/metric_definitions.md
- knowledge/global/sql_rules.md
- knowledge/global/lifecycle_maturity.md
- knowledge/global/identity_channel.md
- knowledge/global/payment_policy.md
- knowledge/global/field_pitfalls.md
- knowledge/global/data_quality_playbook.md
- knowledge/global/analysis_method.md
- knowledge/projects/xiafangle/FACTS.md
- knowledge/projects/wanyue/FACTS.md
- knowledge/projects/bubu/FACTS.md
- knowledge/projects/baodanfeshe/FACTS.md
- knowledge/projects/luobo4/FACTS.md
- knowledge/templates/INDEX.md

### 路由调整
- PROJECT_WORKING_RULES.md 增加 Canonical 入口。
- README.md 增加 Canonical Knowledge 导航。

### 迁移策略
- 不删除旧 memory/knowledge/sql 文件。
- 新结构作为当前稳定规则最高知识层。
- 历史专题继续保留，冲突时按 Canonical 优先。
- 后续长期规则优先写入 Canonical；一次性分析结论不得污染 Canonical。
