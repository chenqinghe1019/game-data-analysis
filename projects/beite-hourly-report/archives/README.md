# 数据与报表快照

首次完整归档：[2026-11-20 18:51:40](20261120-185140/manifest.json)。382个文件，含正式报表、历史观察副本、测试样例、原始聚合导出、脱敏配置、操作日志及迁移 / 手工补录备份。

| 正式小时存档 | 记录数 | 范围 |
|---|---:|---|
| `runtime/external/hourly-snapshots.sqlite` | 81 | 2026-11-16 24点—2026-11-20 18点 |
| `reports/hero/hourly-snapshots.sqlite` | 3 | 2026-11-20 16—18点 |
| `reports/hero/conversion-snapshots.sqlite` | 3 | 2026-11-20 16—18点 |

同名 `.snapshots.json` 可直接阅读与做Git差异对比。`reports/hero-acquisition-test/` 是测试档，不能当正式双图记录；`runtime/external/*backups/` 是过往迁移 / 清理前备份，可能包含已停用或模拟数据。文件路径中 `tower` 是历史遗留，不代表仍有单独 tower 播报配置。

所有源时间与 SHA256 以 manifest 为准。归档不包含凭据与浏览器资料；独立文件 / 数据库备份不保证横跨所有源的同一瞬间事务一致性。恢复请读 [归档规则](../docs/archive.md)。
