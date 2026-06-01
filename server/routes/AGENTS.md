# server/routes/

> L2 | 父级: ../AGENTS.md

成员清单
healthRoutes.ts: express Router 健康检查端点，返回本地服务存活状态
libraryRoutes.ts: express Router 资料库端点，用 Zod 验证 POST /people 并委派 libraryService 处理 people 与 fragments
researchRoutes.ts: express Router 研究采集端点，用 Zod 验证 POST /research/crawl 并委派 researchService 处理种子 URL 抓取

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
