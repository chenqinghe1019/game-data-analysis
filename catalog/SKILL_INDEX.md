# 技能与插件职责对照（自动生成）

维护源：[project-registry.json](project-registry.json)。Codex技能与云端插件分别安装 / 发布，不做自动覆盖。

| Codex技能 | 职责 | 对应插件技能 |
|---|---|---|
| [game-data-sql-analyst](../.codex/skills/game-data-sql-analyst/SKILL.md) | 编写、修改和核验TrinoSQL | game-data-analysis |
| [game-data-analysis-analyst](../.codex/skills/game-data-analysis-analyst/SKILL.md) | 指标诊断、分层对比和结论验收 | game-data-analysis、slg-analysis、carrot4-analysis |
| [thinkingdata-analysis](../.codex/skills/thinkingdata-analysis/SKILL.md) | 分析模型、看板迁移与验收 | game-tracking-dashboards |
| [tracking-yaml](../.codex/skills/tracking-yaml/SKILL.md) | 本地规格转标准YAML | game-tracking-dashboards、game-event-review |
| [daily-report-screenshot](../.codex/skills/daily-report-screenshot/SKILL.md) | 提供数据到Excel和图片预览 | game-data-analysis |
| [beite-hourly-report](../.codex/skills/beite-hourly-report/SKILL.md) | 生产取数、追加、发送和定时维护 | 无直接对应 |
| [auto-project-handoff](../.codex/skills/auto-project-handoff/SKILL.md) | 盘点当前状态和换账号资料 | 无直接对应 |

插件发布镜像：[游戏数据分析之旅](../plugins/game-data-analysis-journey/README.md)。快照版本以其sync-state为准。
