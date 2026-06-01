# server/

> L2 | 父级: ../AGENTS.md

成员清单
AGENTS.md: Express 后端模块地图，约束启动、路由、服务、数据库与测试的职责边界
db/: SQLite 数据库模块，承载连接、迁移与 DDL 边界
db/connection.ts: better-sqlite3 连接边界，开启 foreign_keys 并返回同步 SQLite 句柄
db/migrate.ts: SQLite schema 初始化器，读取 schema.sql 并执行 DDL
db/schema.sql: Digital Mentor Matrix 核心 SQLite DDL，定义七张本地优先业务表
test/: 后端测试模块，承载 Vitest 契约与回归测试
test/db.test.ts: 数据库迁移回归测试，验证核心七表按名称创建

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
