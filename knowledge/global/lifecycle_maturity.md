# 生命周期与成熟样本

status: current
effective_date: 2026-10-08
last_verified: 2026-10-08
supersedes: memory/projects/跨项目_生命周期成熟统计口径.md

## 默认定义
- D1 = 起始日当天，days=0。
- Dn = 起始日+(n-1)。
- 分日指标默认按对应天数分别成熟。
- 对 days=k，成熟条件：
  date_add('day', k, start_date) <= date_add('day', -1, current_date)

## 原则
1. 同一张 D1-D14 表中，不默认要求所有 cohort 统一成熟到 D14。
2. D1 可使用更多近期 cohort，D14 只能使用已走完 D14 的 cohort。
3. 只有用户明确要求“完全一致 cohort”时，才按最大观察天数统一成熟。
4. 未成熟样本不得用残缺累计值冒充成熟指标。

## 事件延展
cohort 日期筛选和事件日期扫描是两件事。筛选 8 月新增，不代表后续事件也只能扫描 8 月。
生命周期分析必须按目标 Dn 自动延展事件窗口。

## 历史快照
需要“新增第 N 天的 VIP/标签/状态”时，必须匹配目标自然日的历史快照，不能用当前值代替历史值。
history_tag 的 $tag_date 为 YYYYMMDD integer，应使用：
cast(date_format(target_date,'%Y%m%d') as integer)

## 历史 VIP
- 表：ta.history_tag_xx
- cluster_name='vip_level_today'
- 用户关联：业务表 #user_id = history_tag.#long_id
- 值：tag_value_num
- 缺失默认 VIP0
