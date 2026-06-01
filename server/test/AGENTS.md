# server/test/

> L2 | 父级: ../AGENTS.md

成员清单
app.test.ts: Vitest Express 应用路由测试，验证 health、people list/create 与 400 JSON 输入验证契约
db.test.ts: Vitest 数据库契约测试，验证迁移创建核心 Digital Mentor Matrix 七表
evaluationService.test.ts: Vitest 评审服务测试，验证 evaluation 与 critique 记录持久化
libraryService.test.ts: Vitest 资料库服务测试，验证人物、来源、片段、归属不变量与 DB 行到 shared schema 映射
modelService.test.ts: Vitest 模型服务测试，验证 OpenAI 兼容 chat/completions 请求与 JSON 文本返回
researchService.test.ts: Vitest 研究服务测试，验证种子 URL 正文抽取、去重与 crawl job 成功落库
skillService.test.ts: Vitest 技能蒸馏服务测试，验证 citation-aware skill 持久化与引用约束

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
