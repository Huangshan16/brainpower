# server/routes/

> L2 | 父级: ../AGENTS.md

成员清单
conversationRoutes.ts: express Router 会话端点，用 Zod 验证 conversation/participant/message/run payload 并委派 conversationService/conversationRunService
evaluationRoutes.ts: express Router 评审与 critique 端点，用 Zod 验证 POST /evaluations 与 POST /critiques 并委派 evaluationService
healthRoutes.ts: express Router 健康检查端点，返回本地服务存活状态
libraryRoutes.ts: express Router 资料库端点，用 Zod 验证 POST /people 并委派 libraryService 处理 people 与 fragments
personaRoutes.ts: express Router persona 库端点，提供列表、nuwa 导入与软删除接口并委派 personaLibraryService/nuwaGatewayService
researchRoutes.ts: express Router 研究采集端点，用 Zod 验证 POST /research/crawl 并委派 researchService 处理种子 URL 抓取
skillRoutes.ts: express Router 技能蒸馏端点，用 Zod 验证 /skills/distill 与 /skills/distill/jobs 并委派 skillService/distillationService

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
