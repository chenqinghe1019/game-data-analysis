# 飞鱼游戏·倍特工作室

游戏数据分析、埋点、数数看板与自动小时报的代码和知识库。

| 你要做什么 | 从这里开始 |
|---|---|
| 换账号、新会话或新电脑接手 | [自动项目交接](projects/auto-project/START_HERE.md) |
| 找游戏、系统编号、资料和代码入口 | [项目注册索引](catalog/PROJECT_INDEX.md) |
| 找指标、支付、身份、成熟样本等有效规则 | [Canonical知识索引](knowledge/CANONICAL_INDEX.md) |
| 查看或维护正式小时报 | [倍特小时报](projects/beite-hourly-report/README.md) |
| 选择Codex技能及对应插件 | [技能与插件职责索引](catalog/SKILL_INDEX.md) |
| 更新知识、打包、提交前检查 | [仓库维护规则](docs/repository-maintenance.md) |
| 了解本次优化影响 | [2026-11-20影响说明](docs/optimization-impact-20261120.md) |

## 目录职责

```text
.codex/skills/                 7套Codex项目技能及必要参考
.codex/tools/gravity-report/   现有小时报生产代码、后台与调度
catalog/                      项目注册源、生成索引与包的版本清单
knowledge/                    当前稳定规则与项目FACTS
projects/beite-hourly-report/  小时报文档、归档、维护工具及知识包
projects/auto-project/        当前进度、资料缺口、交接、成品和验收样例
plugins/                      已发布ChatGPT插件的版本镜像（独立发布）
sql/、游戏项目/               已验证SQL、配置和游戏专项资料
memory/、weekly_notes/         历史专题及阶段记录，使用前核对有效性
docs/                         埋点、治理与仓库维护说明
scripts/                      不触碰生产的知识构建与检查工具
.github/workflows/            提交后的离线自动检查
```

根目录仍保留既有的项目tracking YAML、project_memory.yaml、tracking_projects.yaml、SQL规则和各系统操作地图。为保留引用和运行路径，本次没有批量移动它们。

## 更新与校验

修改源文档或catalog/project-registry.json后运行：

```text
python scripts/repo-maintenance.py build
python scripts/repo-maintenance.py check
```

构建会同步已登记参考文件、生成两个导航索引、四个确定性压缩包和catalog/generated-state.json。内容不变则包不变；忘记同步会在GitHub自动检查中报错。

构建默认不安装本机技能。需要安装时明确指定，例如：

```text
python scripts/repo-maintenance.py build --install beite-hourly-report
```

已有package脚本保留，安装时增加--install。已上传GPT知识和已发布插件不会随GitHub构建自动升级。

## 规则与状态

- 当前用户明确要求优先；随后按工作规范、Canonical和项目特定最新规则定位。
- 稳定事实、历史分析、模拟、资料缺失、运行观察分开记录；登记状态不等于实时调度开关。
- 数数44存在英雄小时报与历史弯月资料重叠，喵喵岛52与逍遥27不可混用。具体说明见注册索引。
- 真实业务数据按用户授权归档；账号密码、Webhook密钥、浏览器资料、CLI令牌留本机。
- GitHub检查不登录业务系统、不拉数据、不生成正式截图、不推送，不启停Windows任务。
- 当前缺失材料及尚未接入的企业微信文档同步见交接STATUS，不将计划写成已实现。
