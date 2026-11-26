# 时光鸡：客服空间

status: current
last_verified: 2026-11-26

## 项目身份与入口

- 用户称“时光机”，数数当前项目名称为“时光鸡”，项目编号 36，数据表 `ta.v_user_36` / `ta.v_event_36`。
- 客服空间内看板：[全服玩家信息](https://ta-data.feiyu.com/#/panel/panel/36_2255_0)，SQL 报表 6331。
- 来源为用户指定的项目 44 看板 1760、报表 4738；来源页面当前名称为弯月勇者。此来源不改变项目 44 的上下文隔离规则。
- 空间共享设置已保存并重新打开核实：`普客`成员组为`查看者`。保留 `requireReferredProjectPrivilege=true`，没有修改项目级数据权限。

## 客服报表适配口径

- 正式角色使用用户表 `domain='release'`，`#active_time >= timestamp '2024-05-23 10:49:00'`、`#reg_time` 有值、`create_role_time > 0`。正式环境和时间基线参考当前项目报表 2966。
- `create_role_time` 是 Unix 秒，使用 `from_unixtime`；`latest_online_time` 是 timestamp，直接使用。
- 历史充值来自 `pay_log`，限定正式环境、`change_reason=1 AND pay_result=1`，`sum(payment)/100.0` 转为元。当前项目报表 2966 确认此单位和成功条件；起始分区为 2024-05-23，事件时间为上述基线。
- 账号汇总键依次使用非空 `nb_open_id`、非空 `open_id`、角色 `#account_id`。先汇总账号累充、最早创角时间和最后在线，再应用查询筛选，避免单角色筛选截断账号信息。
- 保留来源 16 个展示列，以及角色 id、创角渠道 ID、服务器 ID、创角时间四个参数。渠道字段是字符串，数字筛选前使用 `try_cast(reg_channel AS double)`。
- 创角时间默认从 2024-05-23 至今日；角色、渠道、服务器默认有值。后续业务变更应重新核对在线 SQL。

## 验收范围

- 原生导入成功：创建 1 张看板和 1 张报表；实际看板已显示结果，四个参数已核对。
- 迁移 SQL 静态默认条件测试成功；已回读空间普客查看权限。未冒用普客成员账号进行登录测试。
- SQL 保存于本目录 `customer-player-info.sql`。原始玩家行和浏览器授权资料不入仓库。
