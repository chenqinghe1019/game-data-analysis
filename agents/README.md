# 游戏数据分析 Agent 协作规范

版本：0.1，2026-11-24。基础配置；用户指定的 ChatGPT 项目「游戏数据分析之旅」对话「扩展AI数据分析应用」尚未取得原文。本文件的角色划分、触发与协作策略为待核对的初始方案，不冒充原对话决策。

## 共用入口和职责源
- 主 Agent 负责理解任务、锁定项目及指标口径、选择角色、收集证据、处理冲突、整合最终交付和执行已授权写入。
- 根 PROJECT_WORKING_RULES.md、knowledge/CANONICAL_INDEX.md、catalog/PROJECT_INDEX.md 为业务规则来源；catalog/SKILL_INDEX.md 为既有技能索引；禁止另造业务知识副本。
- 此文件是共用协作规则；.codex/agents/ 下是 Codex 薄适配；agents/CHATGPT.md 是普通聊天/Work 的指令入口。
- Codex 项目使用实际自定义子 Agent；ChatGPT 普通聊天按能力顺序执行角色流程，有真实子 Agent 能力才并行委派。不得把逻辑分工宣称为真实多 Agent 执行。
- 简单单一 SQL/指标问题直接处理；复杂跨领域或需独立验证的问题按需委派，默认最多同时 3 个子 Agent，禁止无目的全员启动或递归委派。主 Agent 对最终结果负责。

## 角色路由
- game_sql：SQL编写、修改、调试及口径核验。读取 .codex/skills/game-data-sql-analyst/SKILL.md 和对应项目 FACTS、tracking、最新验证 SQL。确认主体、表号、支付单位、成熟窗和 JOIN 粒度，输出完整 Trino SQL、核查步骤、证据与未验证项。
- game_analysis：游戏数据诊断、活动/合服/留存/付费分析。读取 .codex/skills/game-data-analysis-analyst/SKILL.md；检查样本、时间窗、粒度和数据质量，先总体后拆人群及节点，计算变化并区分观察、推断和因果。输出数据证据与可落地建议。
- game_tracking：埋点设计、数数看板与指标配置。读取 .codex/skills/thinkingdata-analysis/SKILL.md 和 .codex/skills/tracking-yaml/SKILL.md，确认项目、事件、属性、分析模型及验收方式。默认只规划和核对，不自行修改线上看板。
- game_reporting：报表、图表、小时报和运营汇报。读取 .codex/skills/daily-report-screenshot/SKILL.md；小时报另读 .codex/skills/beite-hourly-report/SKILL.md 与项目文档。明确数据来源、分母、展示和验收，不运行正式调度、推送或改正式数据库。
- game_review：独立核验数据、SQL、结论和交付物。只读审查，核对主体、JOIN 重复、日期成熟、金额单位、空值、分母、原始证据与结论；给出严重程度、证据、复现或修复建议。不替代主 Agent 写入或发布。
- game_knowledge：知识沉淀、去重、版本维护与跨会话交接。读取 docs/repository-maintenance.md、catalog/generated-state.json 与 .codex/skills/auto-project-handoff/SKILL.md；识别长期有效且已确认的变化与历史/未验证材料，提出源文件更新和验收建议。默认不提交、不改发布镜像或生成副本。

## 协作协议
1. 固定任务输入：目标、项目与系统编号、数据日期/时区、主体与粒度、指标定义、数据来源及版本、允许操作、期望交付。未知字段显式标记，不猜。
2. 主 Agent 先查注册索引/Canonical；能独立执行的取数规则核验、资料查找可并行；后续分析须等待口径及数据确认。
3. 子 Agent 返回：角色、完成状态（已验证/未验证/阻塞）、方法、证据路径或数据范围、结果、风险、建议下一步。没有工具或数据不得假报运行。
4. 复杂交付经 game_review 独立审查；若有严重口径/数据错误，修复后重审。主 Agent 统一输出精简中文、关键结论和支撑数据，不堆叠重复报告。
5. 默认只读取数据或生成本地草稿。线上看板变更、生产推送、调度启停、数据库写入、仓库提交仅由主 Agent 在明确授权范围内执行；子 Agent 不并行写同一文件。凭据不入库。

## 持续维护
- 已确认的稳定规则回写原 Canonical/项目 FACTS/对应 Skill，不把单次结论提升为永久规则。
- 复用现有每日北京时间19:00知识维护任务；本配置本身不会启动新定时任务、同步插件或改写现有自动化。
- 只更新源文件；涉及已登记打包输入时执行 python scripts/repo-maintenance.py build 和 check；插件版本独立发布。
- 获取「扩展AI数据分析应用」原文后逐项对照并更新本文件和适配器，保留变更来源与日期。

## 验收场景
- 单条 SQL 改为角色维度：game_sql，核对项目主体，保持其余口径不变。
- SLG 合服活动分析：game_analysis + game_sql（需要取数时）+ game_review；按成熟观察窗比较活跃、流水和回访。
- 广告看板修改：game_tracking，核对分子分母，授权后修改并验收，不改其他看板。
- 小时报异常：game_reporting + game_review；先只读查现状，不重复开启调度。
- 发现长期新口径：game_knowledge 给出更新位置与证据；主 Agent 在授权内执行维护。

## 参考
- Codex 自定义 Agent 官方说明：https://developers.openai.com/codex/subagents
