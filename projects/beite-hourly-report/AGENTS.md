# 倍特小时报维护约定

- 先读本目录 README 与相应 docs。生产源码在仓库根 `.codex/tools/gravity-report/`，不要搬动正在运行的入口或再起一套调度器。
- 指标、底档、历史追加与上线状态以最新配置 / docs 为准。修改规则后运行 `scripts/package-skills.py` 同步技能参考和安装包；不能只更新文档或只更新技能。
- 模拟使用独立输出目录与独立数据库；英雄 runner 的 `--preview` 单独使用仍会落盘，必须指定隔离输出。
- 历史观察从只读 SQLite 导出副本，不能清空线上数据库。不要把 archives 快照直接覆盖新生产数据。
- 本项目业务数据已获用户授权保存到当前仓库；认证秘密仍排除。归档运行 `archive-project.py`，提交前运行 `audit-archive.py` 和离线 `verify-project.mjs`。
- 未经新要求，不启停定时、不触发推送、不修改在线文档。企微文档同步当前尚未接入生产。
