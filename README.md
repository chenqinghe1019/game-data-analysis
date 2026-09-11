# 飞鱼游戏-倍特工作室 Codex 知识库

这个仓库用于同步项目相关的 Codex 知识资产，方便换电脑后继续使用同一套埋点、数数看板、SQL 和分析流程。

## 内容

### Skill 定义（`.codex/skills/`）

当前仓库维护的自定义 Skill：

- `tracking-yaml`
  - 把埋点 Excel / CSV / 文本表格整理为标准 YAML。
  - 路径：`.codex/skills/tracking-yaml/`
- `game-data-sql-analyst`
  - 倍特工作室 SQL 主 Skill。
  - 用于新建 SQL、修改 SQL、报错修复、口径核查、跨项目迁移以及留存/LTV/付费/活跃/关卡/阵容/渠道/区服等分析。
  - 强制先读取 GitHub 当前项目知识，再生成或修改 SQL；默认返回最终完整 TrinoSQL；执行成熟口径、金额单位、日期、分子分母、关联键等自检；用户确认的长期规则需要回写 GitHub。
  - 路径：`.codex/skills/game-data-sql-analyst/`

每个 Skill 通常包含：

- `SKILL.md`：触发描述、工作流、优先级、输出规范。
- `agents/openai.yaml`：Codex agent 接口配置。
- `references/*.md`：Skill 引用的检查清单或 schema 文档。
- `scripts/*`：需要时使用的配套自动化脚本。

### SQL 知识源

SQL Skill 不把所有业务规则复制进 `SKILL.md`，而是从仓库读取当前知识：

- `project_memory.yaml`：项目映射、稳定项目口径、跨项目规则、成熟样本规则。
- `assistant_sql_response_rules.yaml`：SQL 调整、调试和最终完整 SQL 输出规范。
- `sql_templates.yaml`：可复用 SQL 模板和通用结构。
- `*_tracking.yaml`：各项目埋点、事件、字段、类型和项目规则。
- `memory/`、`memory/projects/`：专题和项目级确认口径。
- `sql/`：已验证或可复用的 SQL 实现。

SQL 规则优先级：

`当前用户明确要求 > 最新项目/专题规则 > 最新已验证 SQL > 稳定全局规则 > 通用模板 > 推断`

### 埋点规格

- `tracking_projects.yaml`：埋点项目索引（项目名 → YAML 文件映射）
- `fangkuai_tracking.yaml`：方块也疯狂 埋点结构（事件、参数、用户属性、公共属性）
- `xiafangle_tracking.yaml`：下方了 埋点结构
- `xiafangle_anti_cheat_tracking.yaml`：下方了 外挂治理埋点与规则口径（表后缀 41）
- `bubu_tracking.yaml`：步步项目 埋点结构与项目口径（表后缀 22）
- `baodanfeshe_tracking.yaml`：暴弹飞射 项目表、时间字段、付费与动态日期口径（表后缀 42）
- `luobo4_tracking.yaml`：萝卜4小游戏 初版埋点结构、待确认字段与接入注意项

### SQL 口径

- `sql/xiafangle_anti_cheat_report_v41.sql`：下方了 外挂异常玩家名单统计 SQL，按角色ID、区服、异常类型聚合，输出 VIP、累充、战力、赛季、渠道等字段。

### 操作地图（`*_operation_map.yaml`）

记录各系统的项目 ID、表结构规则、接口路径，供 Codex 操作时定位。

- `ta_data_operation_map.yaml`：数数后台
- `gravity_operation_map.yaml`：引力引擎
- `wechat_ad_operation_map.yaml`：微信广告后台

### 工作流规范（`*_workflow.yaml`）

记录操作流程、完成标准、注意事项。

- `ta_dashboard_report_workflow.yaml`：数数看板 / 报表编辑、保存、验收流程
- `applogger_baoweiluobo4_workflow.yaml`：保卫萝卜4 AppLogger 三端趋势分析定位、指标、导出与汇总口径

### SQL 模板（`sql_templates.yaml`）

可复用的查询模板和口径说明，按项目或主题组织。

## 在哪里看现有 Skill

### GitHub

仓库中的所有自定义 Skill 都在：

`.codex/skills/`

直接打开对应目录即可查看 `SKILL.md`、`agents/`、`references/` 和 `scripts/`。

### 本机 Codex

安装到本机后的 Skill 默认放在：

`%USERPROFILE%\.codex\skills\`

可以直接进入这个目录查看当前本机已经安装的 Skill。仓库中的 Skill 与本机 Skill 是两份文件：GitHub 作为知识源和同步源，本机目录决定当前 Codex 实际加载的版本。

## 换电脑恢复

1. clone 这个仓库。
2. 将需要的 Skill 目录从 `.codex/skills/` 复制到 `%USERPROFILE%\.codex\skills\`：
   - `.codex/skills/tracking-yaml`
   - `.codex/skills/game-data-sql-analyst`
3. 打开 Codex 后确认可用 Skill 中出现对应名称。
4. 数数后台仍按安全策略处理：Codex 打开浏览器，你手动登录，Codex 只接管已登录会话，不保存账号密码。

## SQL Skill 工作方式

以后处理倍特工作室 SQL 时：

1. 识别项目和任务类型。
2. 优先读取 GitHub 当前项目配置和专题知识。
3. 找到已有同类 SQL 时，以最新验证版本为基础修改，不重新独立造一版。
4. 明确 cohort、日期、成熟口径、当日/累计、分子、分母、金额单位和关联键。
5. 生成或修改 SQL。
6. 执行 `.codex/skills/game-data-sql-analyst/references/sql-review-checklist.md` 自检。
7. 默认输出最终完整 SQL。
8. 用户确认了长期有效的新规则或纠正后，将规则同步回 GitHub。

## 同步规则

以后这个项目内的 Skill、YAML、SQL 知识有新增或修改后，需要同步到 GitHub。

典型本机 Git 流程：

```bash
git add .codex/skills *.yaml *.yml README.md .gitignore sql memory
git commit -m "Update Codex project knowledge"
git push
```

通过 GitHub API / Connector 修改时，每个写入操作会直接形成 GitHub commit，不需要再额外执行本机 `git push`。

提交前仍要检查不要包含账号、密码、token、临时业务数据、截图或前端大包。

## 不提交的内容

`.gitignore` 默认忽略所有临时文件，只放行 YAML、README、SQL、memory 和 `.codex` 项目 Skill。以下内容不应进入 git：

- 登录 token、账号、密码。
- 浏览器抓取的前端大包，例如 `ta_umi.js`、`ta_micro_umi.js`。
- 临时接口脚本、截图、查询结果、导出的业务数据。
- Excel 原始导出文件，除非你明确需要归档。
