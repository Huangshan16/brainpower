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
logger.ts: 结构化日志边界，统一输出后端 request/service/model 调试事件
routes/: Express 路由模块，承载薄 HTTP 边界并委派服务层
routes/evaluationRoutes.ts: 评审与 critique 路由，提供 POST /api/evaluations 与 POST /api/critiques 入口
routes/healthRoutes.ts: 健康检查路由，提供 GET /api/health
routes/libraryRoutes.ts: 资料库路由，提供 people 与 fragments HTTP 入口
routes/researchRoutes.ts: 研究采集路由，提供 POST /api/research/crawl 入口与 Zod 输入校验
routes/skillRoutes.ts: 技能蒸馏路由，提供 POST /api/skills/distill 入口与 Zod 输入校验
services/: 后端服务模块，承载业务 SQL 与领域数据映射
services/evaluationService.ts: 项目评审服务，封装评审输出、风险问题与 critique 落库
services/libraryService.ts: 资料库服务，封装 people/sources/fragments 的 SQLite 读写与 shared schema 映射
services/nuwaGatewayService.ts: nuwa-skill 网关服务，解析 README 已蒸馏人物并输出可导入 persona 行
services/personaLibraryService.ts: persona 库服务，封装 people 表的 PersonaSchema 映射、导入去重与软删除
services/modelService.ts: OpenAI 兼容模型服务，封装 chat/completions JSON 请求与响应提取
services/researchService.ts: 研究采集服务，封装种子 URL 抓取、正文抽取、去重与 crawl job 状态更新
services/skillService.ts: 技能蒸馏服务，封装人物片段引用校验与 skill 持久化
routes/personaRoutes.ts: persona 库路由，提供 /api/personas 列表、nuwa 导入与软删除 HTTP 入口
test/: 后端测试模块，承载 Vitest 契约与回归测试
test/app.test.ts: Express 应用路由测试，验证 health、people list 与 persona import HTTP 契约
test/nuwaGatewayService.test.ts: nuwa 网关测试，验证 README 已蒸馏人物解析与导入行归一化
test/personaLibraryService.test.ts: persona 库服务测试，验证导入去重、PersonaSchema 映射与软删除
test/db.test.ts: 数据库迁移回归测试，验证核心七表按名称创建
test/evaluationService.test.ts: 评审服务测试，验证项目评审与 critique 记录落库
test/libraryService.test.ts: 资料库服务测试，验证人物创建、排序与 DB 行映射
test/modelService.test.ts: 模型服务测试，验证 OpenAI 兼容 chat/completions 请求与 JSON 文本提取
test/researchService.test.ts: 研究服务测试，验证正文抽取、重复 URL/内容去重与 crawl job 状态
test/skillService.test.ts: 技能蒸馏服务测试，验证 citation-aware skill 生成与持久化

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
