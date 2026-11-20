# 仓库导航与更新流程

GitHub 仓库：`chenqinghe1019/game-data-analysis`，默认分支 `master`。正式业务口径按项目维护在仓库原有目录，插件版本保存在 `plugins/game-data-analysis-journey/`。

| 要找的知识 | 先读 |
|---|---|
| 指标、SQL、去重主体、金额、观察窗口和验数 | `knowledge/CANONICAL_INDEX.md` 下的 global 文档及对应项目 FACTS |
| 事件、属性、项目 ID、上报端与数据来源 | `tracking_projects.yaml`、相应 tracking YAML 和项目 FACTS |
| SQL 编写与调试 | `.codex/skills/game-data-sql-analyst/SKILL.md`、项目口径与最新验证 SQL |
| 数数 TA 看板、报表与迁移 | `ta_dashboard_report_workflow.yaml`、Canonical 数数看板迁移及数据菜单 |
| 保卫萝卜 4 AppLogger | `applogger_baoweiluobo4_workflow.yaml`；与萝卜4小游戏埋点按数据源区分 |
| 企微与游戏社区 | `knowledge/projects/game-community/WECOM_DASHBOARD.md`、`game_community_tracking.yaml` |
| 倍特小时报和买量转化 | `projects/beite-hourly-report/README.md` 及对应专题指标文档 |

## 更新规则

1. 只在用户确认且规则可复用时更新。写清适用项目、分子分母或条件、验证来源、确认日期和被替代的口径。临时报表筛选、一次性结论和未证实假设继续留在该次分析。
2. 先读取默认分支最新版本。已有口径在对应 Canonical、项目 FACTS、专题、埋点文件或已验证 SQL 就地修改；新专题补入口索引。验证相关链接、字段名和单位，保留不相关内容。
3. 有已授权 GitHub 写入工具时，直接提交到 `master`。提交应基于当前分支头，分支并发变化时重新读取并合并，禁止强制覆写。有能力时把同一变更的相关文件放在同一提交。验证分支和提交，从当前会话返回链接。
4. 每天北京时间 19:00 的任务整理过去 24 小时内可读取的 ChatGPT 和 Codex 游戏数据分析对话，把已确认的长期业务知识及可核实的代码更新到仓库对应位置。对话来源不可读或检索不全时记录覆盖缺口。插件源码目录保存已发布版本的快照，插件发布与源码镜像按实际变更单独同步。
