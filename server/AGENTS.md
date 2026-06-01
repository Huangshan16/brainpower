# server/

> L2 | 父级: ../AGENTS.md

成员清单
AGENTS.md: Express 后端模块地图，约束启动、路由、服务、数据库与测试的职责边界
app.ts: Express 应用装配边界，挂载 CORS、JSON 中间件与 /api 路由
config.ts: dotenv 配置边界，集中提供端口与 SQLite 数据库路径
db/: SQLite 数据库模块，承载连接、迁移与 DDL 边界
db/connection.ts: better-sqlite3 连接边界，开启 foreign_keys 并返回同步 SQLite 句柄
db/migrate.ts: SQLite schema 初始化器，读取 schema.sql 并执行 DDL
db/schema.sql: Digital Mentor Matrix 核心 SQLite DDL，定义七张本地优先业务表
index.ts: Node 进程入口，创建数据库、执行迁移并启动 Express 服务
routes/: Express 路由模块，承载薄 HTTP 边界并委派服务层
routes/healthRoutes.ts: 健康检查路由，提供 GET /api/health
routes/libraryRoutes.ts: 资料库路由，提供 people 与 fragments HTTP 入口
services/: 后端服务模块，承载业务 SQL 与领域数据映射
services/libraryService.ts: 资料库服务，封装 people/sources/fragments 的 SQLite 读写与 shared schema 映射
test/: 后端测试模块，承载 Vitest 契约与回归测试
test/app.test.ts: Express 应用路由测试，验证 health 与 people list HTTP 契约
test/db.test.ts: 数据库迁移回归测试，验证核心七表按名称创建
test/libraryService.test.ts: 资料库服务测试，验证人物创建、排序与 DB 行映射

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
