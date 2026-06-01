# Experience

## 已沉淀经验
- 数字人物输出必须带证据、置信度和诚实边界，避免变成无来源拟人表演。
- 若 Vitest setupFiles 指向缺失文件，业务测试会在收集前失败；先恢复测试入口再验证目标红测。
- 后端路由保持薄层，SQL 只进入 service 文件；测试用 shared schema parse 防止数据库字段命名漂移。
- researchService 用 URL 去重加正文 hash 去重，source 作为归属真相源，fragment 只保存正文结果，能避免采集状态分叉。
- 对评审记录这类快照数据，人物/技能引用适合保存为快照字段；真正需要强一致的关系再保留外键，能减少演进阻力。
- 前端 seed 数据更适合显式宽类型；直接 `as const` 传给可变组件 props，容易在 readonly 与字面量状态上卡住 TypeScript build。
