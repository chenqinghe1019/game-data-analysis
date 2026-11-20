# 源码与配置地图

代码根目录：`.codex/tools/gravity-report/`。现有文件名保留 gravity-report，产品归属统一为「倍特小时报」。项目目录是资料与交付入口，不是第二个调度器。

| 模块 | 职责 |
|---|---|
| `game-projects.mjs` / `game-projects.html` | 项目注册、脚本分配、项目页、排序与历史入口 |
| `config.mjs` / `defaults.json` | 项目配置、引力参数、数数卡片、指标、单位、小时开关、标题模板校验 |
| `panel.mjs` / `panel.html` | 本机后台 API / UI，串行作业、调度、配置保存 |
| `panel.ps1` / `install-schedule.ps1` | Windows 任务保活与隐藏启动 |
| `run.mjs` | 引力登录、条款勾选、查询等待、项目媒体采集、原始汇总绑定、生成与推送 |
| `gravity-validation.mjs` | APPID 绑定、明细与汇总校验、原始成本和 ROI 对照 |
| `login.mjs` / `webhook.mjs` | Windows CurrentUser DPAPI 凭据保存，Webhook 格式校验 |
| `external-hourly.mjs` | 数数看板卡片导出、联合指标、SQLite、追加、底档与留存、Excel / PNG |
| `external-retry.mjs` | 联合小时报调度重试及逐消息状态 |
| `external-history.mjs` | 只读全历史，导出独立观察副本 |
| `hero-acquisition-source.mjs` / `hero-acquisition.mjs` | 数数投放卡片、多媒体校验汇总、买量表与累计消耗 |
| `hero-conversion-source.mjs` / `hero-conversion.mjs` | 激活登录看板取数、CSV 解析、转化节点与标签 |
| `hero-conversion-history.mjs` | 转化分时存档、横向单行输出 |
| `run-hero-acquisition.mjs` | 英雄双表正式流程，两张图片后接标题 |
| `hero-history.mjs` | 两个存档取已完整配对时点，输出同一文件两个 sheet |
| `report-workbook.mjs` | 临时文件导出后替换，文件被占用时明确报错 |
| `wecom-image-batch.mjs` | 逐图发送、MD5 / Base64、2MB 限制、部分成功恢复 |

## 本机状态

配置目录：`%LOCALAPPDATA%/GravityWeComReport/`。

- 根 `config.json`：下方了；`iaa/config.json`、`external/config.json`、`hero/config.json`：对应项目。
- `scheduler.json`：项目执行顺序。
- `*.dpapi`：本机凭据，不可跨 Windows 用户直接恢复，也不进仓库。
- `Chrome/`、`TA-Chrome/`：浏览器会话，不进仓库。
- `sent-slots/`：小时任务 / 消息状态；不要批量清理或当成新电脑初始化资料复制。
- `external/hourly-snapshots.sqlite`：联合小时报权威分时数据。

输出目录：工作区 `outputs/gravity-wecom/`。英雄买量与转化数据库在 `hero/` 下；联合正式 Excel 在 `external/`；历史观察副本分别在 `external-history/` 和 `hero-history/`。

## 数据源

| 项目 | 来源 |
|---|---|
| 下方了 | 引力报表 `1776394520115533`；项目分组与 APPID 从实际配置读取 |
| IAA | 引力报表 `1794471283176646`；字段由后台维护 |
| 别推我的塔 | 引力报表 `1794557619314845`；数数看板 `51_2221_0` |
| 英雄就是我买量 | 引力报表 `1795155162413133`；数数看板 `44_1749_0`，卡片「投放数据」「【汇总】投放数据」 |
| 英雄就是我前期转化 | 数数看板 `44_1752_0`，卡片「激活登录（排除剧情）」 |

当前配置快照与历史配置均在归档内；若文档记载和新配置不一致，先检查业务变更时间，不能静默用旧值覆盖线上。

## 恢复范围

仓库保存源码、已确认规则、脱敏配置、报表、聚合小时数据与源导出。不会保存账号授权信息或浏览器资料。恢复时重新安装依赖、登录并填写 Webhook；先在独立路径离线生成，再决定是否启用正式定时。
