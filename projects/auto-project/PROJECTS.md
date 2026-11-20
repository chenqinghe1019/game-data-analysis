# 项目与资料索引

游戏身份、分析模型和统计主体都需要明确。相同聊天包含多个游戏，标题不能作为唯一映射。以下看板为历史确认入口；本次仅整理，没有重新访问线上验收。

| 工作对象 | 项目 / 入口 | 仓库知识与产物 |
|---|---|---|
| 倍特小时报 | 下方了、IAA、别推我的塔、英雄就是我 | [统一项目](../beite-hourly-report/README.md)，源码 `.codex/tools/gravity-report/` |
| 下方了 | 数数41，常用角色 `#account_id`、聚合账号 `nb_open_id`，具体依报表 | [FACTS](../../knowledge/projects/xiafangle/FACTS.md)、`xiafangle_tracking.yaml` |
| 别推我的塔 | 数数51；小时看板51_2221；新增分析51_2225/2226/2227；投放51_2088；生态51_2233 | [FACTS](../../knowledge/projects/bietuiwodeta/FACTS.md)、[迁移规范](../../knowledge/global/ta_dashboard_migration.md) |
| 英雄就是我小时报 | 当前脚本数数44_1749/1752与引力报表1795155162413133 | 读小时报配置与文档；**不能仅按表后缀44把旧弯月勇者规则套来**，项目名称 / 数据源是否为重命名需独立核实 |
| 一耍就上头 | IAA_Game=54；游戏筛选 `game_name='yishuajiushangtou'`；关卡54_2165、广告54_2144、时长54_2143 | `yishuajiushangtou_tracking.yaml`、[最终SQL](../../sql/yishuajiushangtou/basic_dashboards_20261102.md)、`materials/yishua-*` |
| 萝卜4小游戏数数 | 项目37；大盘37_1017；报表3513/3846 | [FACTS](../../knowledge/projects/luobo4/FACTS.md)、`luobo4_tracking.yaml`、[大盘SQL](../../sql/luobo4/overview_ad_duration_20261119.md) |
| 保卫萝卜4 AppLogger三端 | 安卓 / 苹果 / 鸿蒙原生AppLogger数据；不是数数37的同一数据源 | `applogger_baoweiluobo4_workflow.yaml`；`materials/luobo4-analysis/`的分析成品 |
| 喵喵岛 | 正确为项目52；**喵喵岛_逍遥=27，不可混用**；主线52_2183 | `project_memory.yaml`、`tracking_projects.yaml`、`materials/tracking-review/喵喵岛_52埋点验收差异_20261023.xlsx`；验收按用户当次指定的本地Excel，不能拿未实施提案当线上规范 |
| 代号T埋点验收 | 必须现场核对项目，不能从其他游戏映射猜表后缀 | `materials/tracking-review/`中T埋点差异修正版与保留格式文档；结论为历史验收，不代表今天数据 |
| 保卫萝卜社收藏家 | 历史项目15，报表15_4945，看板15_250；和萝卜4项目37分开 | 历史要求：扫码来源8/9，收藏家7/8/9，绑定仅prd；当天固定指标一行、商品指标按ABO分行。原YAML当前缺失，见STATUS |
| SLG专项 | 下方了41_6307，来自ChatGPT《自动项目》 | [历史分析记录](SLG_CASE.md)；原账号Library明细文件尚未取得 |
| 数数采集器v0.1 | 历史下方了41_1838里的新增LTV（角色）41_4983 | 仅找到历史对话中的实现与测试结果，源码目录当前缺失；不得与小时报现有采集代码视为同一个程序 |

其他游戏（步步、暴弹飞射、弯月勇者、极速冲刺、社区）保留原知识库权威入口：`knowledge/CANONICAL_INDEX.md` 和 `tracking_projects.yaml`。本次未把其他ChatGPT项目的聊天纳入《自动项目》的对话盘点。
