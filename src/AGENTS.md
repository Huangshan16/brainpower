# src/

> L2 | 父级: ../AGENTS.md

成员清单
AGENTS.md: React 前端模块地图，约束入口、组件、样式与 API client 的职责边界
App.tsx: 前端三面板工作台骨架，持有 workflow、选中人物与 evidence state 并组装主界面
api/: 前端 API seam 模块，承载浏览器到本地 /api 的请求边界
components/: 前端组件模块，承载人物矩阵、工作流切换与三类工作区组件
main.tsx: React 浏览器入口，挂载 App 并引入全局样式
styles.css: 前端全局样式，定义 Research Ops 风格的三面板视觉系统
test/: 前端测试环境模块，承载 Vitest setup 与浏览器断言扩展

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
