---
name: game-data-sql-analyst
description: Build, modify, debug, validate, and adapt TrinoSQL for the 倍特工作室 game-data-analysis projects. Use for SQL需求、SQL调整、报错修复、口径核查、跨项目SQL迁移、留存/LTV/付费/活跃/关卡/阵容/渠道/区服等分析。Always read the repository knowledge before writing SQL, preserve project-specific rules, return the final full SQL by default, run a business-logic QA checklist, and persist newly confirmed reusable rules back into GitHub knowledge files.
---

# Game Data SQL Analyst

这是倍特工作室的数据分析 SQL 主 Skill。它负责“怎么处理 SQL 需求”；GitHub 仓库负责保存“当前正确的项目知识和业务口径”。

## Core Principle

Never start from memory alone when repository knowledge is available.

For every SQL request in this repository:

1. Identify the project and task type.
2. Read the current GitHub knowledge for that project/topic before generating SQL.
3. Reuse the latest verified SQL or template when one exists; do not independently rewrite equivalent logic without a reason.
4. Apply the user's current change request with minimum necessary logic changes.
5. Run SQL syntax/style and business-metric QA.
6. Return the final complete runnable SQL by default.
7. When the user confirms a reusable new rule or corrects an existing rule, update the corresponding GitHub knowledge source so later conversations inherit the correction.

## Knowledge Source Order

Read only what is relevant, but use this priority:

1. `project_memory.yaml` — project mapping, stable cross-project rules, mature-sample rules.
2. `assistant_sql_response_rules.yaml` — SQL response and adjustment rules.
3. Project tracking/config files, for example:
   - `xiafangle_tracking.yaml`
   - `wanyue_tracking.yaml`
   - `bubu_tracking.yaml`
   - `baodanfeshe_tracking.yaml`
   - `luobo4_tracking.yaml`
   - related `*_operation_map.yaml` / `*_workflow.yaml`
4. Topic knowledge under `memory/` and `memory/projects/`.
5. Existing verified SQL under `sql/`; prefer the newest/current version for the same metric or dashboard.
6. `sql_templates.yaml` for reusable structure.
7. Inference only after the sources above are insufficient.

When multiple sources conflict, use this precedence:

`current explicit user instruction > newest project/topic rule > latest verified SQL > stable global rule > generic template > inference`

Do not silently choose an older rule because it appears in more files.

## Task Classification

Classify the request before editing:

- `new_sql`: build a new query.
- `modify_sql`: change an existing query or metric.
- `debug_sql`: fix syntax/type/field/runtime errors while preserving intended business logic.
- `validate_sql`: create a check query or verify numerator/denominator, joins, payment units, date windows, or maturity.
- `cross_project_adapt`: port a proven SQL structure to another project while replacing only project-dependent tables, events, fields, units, and mappings.

For modification/debugging, treat the supplied SQL or the repository's latest equivalent SQL as the base version. Avoid rewriting from scratch unless the original structure prevents correctness.

## Requirement Model

Before producing SQL, resolve as many of these as possible from the request and repository without asking repetitive questions:

- project / table suffix
- target population or cohort
- cohort date field and date selector
- observation window: D1-D7, D1-D30, activity cycle, server-open day, etc.
- daily vs cumulative definition
- mature-sample requirement
- dimensions / grouping
- numerator
- denominator
- amount unit and payment event
- user identity key and join key
- output columns and ordering

If the current request explicitly changes one of these, change that item and inherit the remaining items from the latest verified version.

## Default SQL Style

Unless the current project rule says otherwise:

- Dialect: TrinoSQL.
- Do not use `WITH` / CTE.
- Do not use `USING`; write explicit `ON` joins.
- Return the final complete SQL, not only a patch or fragment.
- Preserve the user's established query style and existing business logic unless the user requests a logic change.
- Prefer Chinese display aliases.
- Keep same-type D1-D7/D30 metrics together unless the user requests another ordering.
- Do not automatically multiply ratios by 100.
- Round monetary display values appropriately, normally to 2 decimals.
- Do not invent fields, event names, table suffixes, payment units, or tag join keys.

## ThinkingData Date Rules

Respect repository rules for `${PartDate:date}`, `${PartDate:date1}`, etc. Dynamic parameters are complete conditions and must not be concatenated with aliases or `"$part_date"`.

For cohort analyses, preserve `"$part_date"` in the cohort-selection scope so the dynamic selector can resolve correctly.

Event scan windows must cover the full observation horizon. Do not accidentally restrict D1-D30 events to the cohort's registration-date selector.

## Mature Sample Rule

Lifecycle, LTV, retention, payment, activity, battle, lineup, and campaign-window metrics use complete mature samples unless the user explicitly requests incomplete/current observations.

General rule:

- First determine the cohort anchor date (registration, server open, campaign start, etc.).
- For a D1-DN metric where D1 is the anchor day, the observation ends at anchor + N - 1 days.
- Include a cohort only when that full observation end date is no later than yesterday.
- Never replace an immature cumulative value with a partial value while labeling it as a mature DN metric.

## Modification Rules

When the user says things like “和竞技场一样”“改成累计”“只要D1-D7”“这个也改”“同一个SQL为什么写法不一样”:

1. Locate the latest relevant implementation.
2. Keep its cohort, maturity, tier, join, and output framework unchanged.
3. Change only the requested business object or metric definition.
4. Verify that the same semantic metric uses the same implementation across sibling SQLs.

Prefer one canonical `latest` implementation per recurring topic. Historical variants may be retained when useful, but future work should start from the canonical version.

## Debugging Rules

For runtime errors:

1. Read the exact error line/message.
2. Confirm the actual field/table/type from repository knowledge or supplied schema.
3. Fix the smallest underlying cause.
4. Re-check adjacent type conversions and join keys so the next obvious error is not left behind.
5. Return the entire corrected SQL.

Do not fix a syntax/type error by changing the metric definition unless the original definition is itself wrong.

## QA Before Final SQL

Run the checklist in `references/sql-review-checklist.md` before answering. At minimum verify:

- correct project and table suffix
- correct user/event tables and event names
- correct date selector scope and event scan extension
- mature sample condition
- daily vs cumulative meaning
- payment unit
- identity/join key and type
- first-day vs historical/cumulative payment tier
- numerator and denominator
- distinct user counting where appropriate
- NULL handling
- required partition filtering
- no prohibited `WITH`/`USING`
- output columns/order match the request

## Output Contract

Default response order:

1. A short note naming the important logic change(s), only when useful.
2. The final full runnable SQL.
3. A concise `改动点` summary when the SQL was modified/debugged.

Do not require the user to ask again for “最终版”.

When the user asks only for an explanation/formula and not SQL, answer the metric logic directly instead of forcing a query.

## GitHub Knowledge Sync

A statement becomes a reusable knowledge update when the user explicitly establishes a lasting rule, for example:

- “以后都这样”
- “这个规则记住”
- “所有项目都要”
- correction of a table suffix, field type, payment unit, mapping, numerator/denominator, maturity rule, or join key that will affect future work

Classify the update:

- global SQL rule → `project_memory.yaml`, `assistant_sql_response_rules.yaml`, or another global rules file
- project stable rule → project tracking/config or `memory/projects/`
- topic/dashboard rule → dedicated YAML/Markdown topic memory
- reusable query implementation → `sql/` or `sql_templates.yaml`

Do not persist one-off temporary filters or ad-hoc values as global rules.

When changing knowledge, preserve existing confirmed rules and add the new correction with enough context/date to prevent stale-rule reuse.

## Safety for Repository Writes

Do not commit credentials, tokens, passwords, private login data, raw business exports, screenshots, or temporary query results. Store only reusable schemas, business definitions, templates, workflow rules, and SQL intended for the knowledge repository.
