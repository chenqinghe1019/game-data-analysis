# 倍特工作室：新会话入口

此工作区在 Codex 中名为《自动项目》。跨账号 / 新会话接手先读 `projects/auto-project/START_HERE.md`，再按任务读取 `PROJECT_WORKING_RULES.md`、`knowledge/CANONICAL_INDEX.md` 和对应项目资料。聊天标题只用于追溯，不是项目边界。

项目身份及入口优先查 `catalog/project-registry.json` / `catalog/PROJECT_INDEX.md`；维护方式见 `docs/repository-maintenance.md`。生成副本不要手改：修改登记源后运行 `python scripts/repo-maintenance.py build` 和 `check`。构建不自动安装本机技能或发布插件。

- 用户本轮明确要求优先；确认来源、项目身份、金额单位和指标分母后再实现。
- 先区分已上线、历史完成、模拟、待办和资料缺失。旧聊天里声称完成不等于代码仍存在或今天仍运行。
- 小时报生产入口在 `.codex/tools/gravity-report/`，归属 `projects/beite-hourly-report/`。整理资料不启停任务、不推送、不覆盖正式数据库。
- 凭据、浏览器资料和授权文件留在本机，不进仓库；换号按清单重新确认连接权限。
- 全局或项目规则有已确认变更时，更新相应知识文件与交接记录；不要把一次性分析结果提升为永久业务口径。

## Agent 协作入口（基础配置 v0.1）

处理游戏数据相关需求时，读取 `agents/README.md`，按其路由选择 `.codex/agents/` 中的专业角色。简单需求直接处理，复杂任务按需委派并独立复核；未提供真实子 Agent 能力时按角色顺序处理，不宣称已并行执行。共享规则以该文件为准，业务口径仍以 Canonical 为准。ChatGPT 项目接入指令见 `agents/CHATGPT.md`。
