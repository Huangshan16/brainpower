# server/services/

> L2 | 父级: ../AGENTS.md

成员清单
conversationRunService.ts: 会话运行服务，封装 direct/group run、多轮异步群聊、状态迁移与 stop 保留消息语义
conversationService.ts: better-sqlite3 会话服务，封装 conversations/conversation_participants/messages 的 CRUD 与 schema 映射
distillationService.ts: better-sqlite3 蒸馏任务 stub seam，提供 distill job 入队与后续 nuwa CLI 扩展边界
evaluationService.ts: 项目评审服务，封装 evaluations/critiques 的模型调用、落库与 shared schema 映射
libraryService.ts: better-sqlite3 资料库服务，封装 people/sources/fragments 的创建、列表、片段归属约束与 snake_case/camelCase 转换
modelService.ts: OpenAI 兼容模型服务，封装 chat/completions JSON 请求与响应提取
nuwaGatewayService.ts: nuwa-skill 网关服务，抓取 README 已蒸馏人物章节并归一化为可导入 persona 行
personaLibraryService.ts: persona 库服务，封装 people 的导入去重、软删除、恢复可见性与 PersonaSchema 映射
researchService.ts: 种子 URL 研究服务，封装 crawl job、正文抽取、URL/内容去重与 sources/fragments 写入
skillService.ts: 人物技能蒸馏服务，封装引用校验、skills 持久化与 shared schema 映射

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
