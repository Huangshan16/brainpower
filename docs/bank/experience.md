# Experience

## 已沉淀经验
- 数字人物输出必须带证据、置信度和诚实边界，避免变成无来源拟人表演。
- 若 Vitest setupFiles 指向缺失文件，业务测试会在收集前失败；先恢复测试入口再验证目标红测。
- 后端路由保持薄层，SQL 只进入 service 文件；测试用 shared schema parse 防止数据库字段命名漂移。
- researchService 用 URL 去重加正文 hash 去重，source 作为归属真相源，fragment 只保存正文结果，能避免采集状态分叉。
- 对评审记录这类快照数据，人物/技能引用适合保存为快照字段；真正需要强一致的关系再保留外键，能减少演进阻力。
- 前端 seed 数据更适合显式宽类型；直接 `as const` 传给可变组件 props，容易在 readonly 与字面量状态上卡住 TypeScript build。
- 前端纵向切片验收先补 API seam 测试，再用独立浏览器截图确认桌面三列与窄视口单列；把逻辑回归和布局回归分开验证，定位更准。
- Playwright 浏览器录证要先把 locator 锁进明确容器，再让 Vitest/Playwright 各自只收自己的测试文件；否则测试边界会互相污染。
- 开源 README 必须写清已实现能力、真实边界、启动方式、验证命令与贡献约束；否则仓库首页会制造错误预期。
- 对真实模型集成，最少要处理 fenced JSON、请求超时、后端错误正文透传；否则用户侧只会看到“点击没反应”。
- 后端调试日志至少要覆盖 requestId、模型原始返回预览、缺字段列表、写库失败上下文；不要等 SQLite 约束替你发现模型 payload 不完整。
- 模型输出 contract 要同时写进 prompt、服务层校验和 ndjson 日志证据；只靠 prompt 是愿望，只靠数据库约束是事故。
- 桌面端整屏工作台不要依赖层层 `calc(100vh - x)`；让 `app-shell -> app-grid -> panel` 统一进入 `min-height: 0` 与内部滚动，页面高度才能稳定收束在视口内。
- RTL/Vitest 如果不在每个用例后执行 `cleanup()`，多个 `render()` 会把同名控件残留在 DOM 里，导致 `getByLabelText` 一类查询出现假性多匹配。
- 身份归并迁移不能只去重主表；凡是持有该身份语义的评审、批评、会话参与者与素材表都要一起重写，否则会留下“人已合并、历史还指向旧 ID”的语义悬空。
- 会话系统必须在服务层校验 `messageId` 和 `runId` 属于当前 `conversationId`；URL 路径只是输入，不是真相源。
- SQLite 本地聊天流若要稳定展示同轮多消息顺序，用 `rowid` 保留插入顺序比 `created_at + id` 更可靠。
