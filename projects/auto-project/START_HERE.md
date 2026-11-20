# 《自动项目》换账号 / 新会话交接入口

整理日期：2026-11-20。仓库：[chenqinghe1019/game-data-analysis](https://github.com/chenqinghe1019/game-data-analysis)，默认分支 master。

## 先读什么

1. [当前进度与缺口](STATUS.md)：哪些已完成，哪些只在历史聊天中出现。
2. [项目与入口索引](PROJECTS.md)：按具体游戏 / 工作类型选源，不凭聊天标题猜项目。
3. 仓库根 [工作规范](../../PROJECT_WORKING_RULES.md) 与 [当前知识索引](../../knowledge/CANONICAL_INDEX.md)。
4. 对应项目 FACTS / tracking YAML / 最新已验证 SQL；小时报读 [倍特小时报](../beite-hourly-report/README.md)。
5. [换号清单](ACCOUNT_HANDOFF.md) 和 [验收样例](ACCEPTANCE.md)。

## 本次整理范围

存在两个同名分组，均纳入索引但不合并身份：

- **Codex本机《自动项目》**：工作区 `C:/Users/feiyu/Documents/飞鱼游戏-倍特工作室`，14个聊天。
- **ChatGPT《自动项目》**：2个聊天，为「整理分析SLG数据」「连通性测试成功」。

已完整分页列出两个来源的活动及归档历史，归档列表均为空；另外15个聊天共读取153轮历史，当前小时报聊天使用当前上下文与已交付项目资料。仅提取用户要求、最终答复及资料定位，不归档模型推理或原始工具调用。单项消息可能受工具文本长度截断，不能宣称是逐字聊天全量备份。[读取清单](evidence/conversation-review.json)

## 快速接手

Codex在克隆后的仓库中工作，根 `AGENTS.md` 会引导读取本入口。技能见 [技能与配置](SKILLS_AND_CONFIG.md)，可从 `packages/` 安装包或仓库 `.codex/skills/` 恢复。

ChatGPT将 [启动指令](BOOTSTRAP.md) 的适用内容设为项目指令，并上传需要的知识文件。新账号必须有相应产品、仓库和业务系统权限；知识包不自动提供登录、后台运行或消息发送能力。

代码与稳定规则放GitHub，小时分时档与报表在倍特小时报归档，其他能找到的关键成品和最终SQL在 `materials/`。历史附件丢失、账号内文件未下载及本机依赖不可用的项目，在 STATUS 明确标记。

## 交接包

- `packages/auto-project-codex-skills.zip`：7套项目技能，可按需安装到新环境的 `.codex/skills/`。
- `packages/auto-project-chatgpt-knowledge.zip`：解压后以BOOTSTRAP为指令参考，其余文件按需加入项目 / 知识资料；不包含实际账号授权。
- `evidence/materials-manifest.json`：39份精选成品/代码/SQL/模板及SHA256，另列2项本地缺失材料。

维护工具：`scripts/collect-materials.py`只读复制和记录状态；`scripts/package-handoff.py`打包技能和知识；`scripts/audit-handoff.py`核对哈希、来源覆盖、入口链接及凭据特征。它们均不触发正式播报。
