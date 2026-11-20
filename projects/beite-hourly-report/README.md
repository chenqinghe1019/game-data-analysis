# 倍特小时报

游戏投放与运营小时报：引力引擎 / 数数看板 → 校验 → SQLite 小时存档 → Excel / PNG → 企业微信群机器人。

本目录统一管理项目说明、配置快照、数据归档、维护工具和 GPT 使用资料。**生产代码继续使用 [`.codex/tools/gravity-report`](../../.codex/tools/gravity-report/)，不移动正在运行的入口，不复制出另一套生产代码。**

## 播报清单

| 项目 | 后台 | 正式入口 | 输出 |
|---|---|---|---|
| 下方了 | `/` | `run.mjs` | 分组、项目、媒体的投放日报快照 |
| IAA | `/iaa` | `run-iaa.mjs` | 同一套项目结构，指标列表与消耗单位可配置 |
| 别推我的塔 | `/external` | `run.mjs`，kind=external | 数数与引力联合小时报，累计文件与全量分时存档 |
| 英雄就是我 | `/hero` | `run-hero-acquisition.mjs` | 买量、前期转化两张截图；同一 Excel 的两个 sheet |

项目列表：<http://127.0.0.1:8732/projects>。执行顺序可配置，已确认的顺序是 **别推我的塔 → 英雄就是我 → 下方了 → IAA**。归档配置仅代表导出时状态，不代表当前定时状态。

## 资料入口

- [运行与迁移](docs/operations.md)：启动、依赖、调度、锁屏、重试、恢复与已知限制。
- [指标与格式](docs/metrics.md)：直接抄引力指标、数数买量口径、多媒体加权、各报表字段。
- [归档与追加](docs/archive.md)：日期小时主键、跨天24点、底档保护、历史副本、手工补录。
- [源码地图与配置](docs/architecture.md)：模块职责、数据流、配置位置和可恢复范围。
- [对话决策与故障经验](docs/decisions.md)：从本次对话整理的最终要求及被替代的方案。
- [企业微信文档接入状态](docs/wecom-doc-sync.md)：已做的验证、权限错误与未完成事项。
- [Codex 技能](../../.codex/skills/beite-hourly-report/SKILL.md)：自包含的维护流程与参考资料。
- [GPT 配置](gpt/INSTRUCTIONS.md)：GPT 指令与知识文件使用方式；不承诺 GPT 自动获得本机执行能力。
- `archives/<导出时间>/manifest.json`：逐文件 SHA256、源路径、数据库记录范围、排除说明。

## 快速使用

当前电脑启动后台：

```powershell
pwsh -NoProfile -File .codex/tools/gravity-report/panel.ps1 -Managed
```

只做离线核查（不取数、不推送、不修改生产数据）：

```powershell
node projects/beite-hourly-report/scripts/verify-project.mjs
```

生成独立归档（Python 标准库；运行中的 SQLite 通过 backup API 一致性备份）：

```powershell
python projects/beite-hourly-report/scripts/archive-project.py
```

新电脑先读迁移文档：依赖包含 Codex 提供的 `@oai/artifact-tool`，不是仅安装普通 Node 就能完整生成截图。账号、密码、Webhook 密钥、Chrome 登录资料、CLI 授权凭据均不进入 GitHub。真实业务报表和小时记录经用户明确同意保存到现有公开仓库。
