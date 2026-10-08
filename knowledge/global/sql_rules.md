# SQL 统一规范

status: current
effective_date: 2026-10-08
last_verified: 2026-10-08

## 基础
- 方言：TrinoSQL。
- 默认禁用 WITH / CTE。
- 默认禁用 USING，JOIN 使用显式 ON。
- 默认返回最终完整 SQL，不只返回 diff。
- 展示列优先中文别名。
- 金额展示通常保留两位。
- 比例/率默认输出 0~1，不自动乘 100。
- 分母使用 nullif(分母,0) 防止除零。
- D1-D7/D30 等同类指标尽量放一起；人数、金额、率按类型组织。

## 日期与分区
- ${PartDate:date} / ${PartDate:date1} 视为当前作用域中的完整 WHERE 条件。
- 不允许拼成 e.${PartDate:date} 或 "$part_date" ${PartDate:date}。
- 新增日期筛选只圈 cohort；后续事件必须自动延展到目标生命周期窗口。
- 所有事件表扫描尽量保留分区过滤。

## 参数空值
- 文本参数常用于 IS NOT NULL 筛选时，需先处理 NULL 与空字符串。
- 文本缺失统一展示“未获取”。
- 金额类缺失默认 0。
- 无业务含义的缺失数值维度可优先用 -1 哨兵。
- COALESCE 各操作数必须保持可兼容类型，varchar 与 integer 不可直接混用。

## JOIN
- 大事件表先压缩到目标粒度再 JOIN。
- pay_log / in_out_log 等不需要逐事件时先聚合。
- 首次发生日期优先 GROUP BY + MIN。
- 需要“最早时间对应值”时优先 min_by(value,time)。
- 避免两个原始明细表直接 many-to-many JOIN。

## 修改原则
- 有现有 SQL 时做最小必要修改。
- 用户说“这个也改”“按前一个口径”时继承同一 cohort、成熟、分层、JOIN 与输出框架。
- 报错修复先修根因，不顺带改变业务定义。
- 数据全 0、NULL 激增、倍率离谱时优先写核查 SQL，不直接给业务结论。
