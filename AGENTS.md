# brainpower - 数字高人矩阵本地工作台

React + TypeScript + Node/Express + SQLite + OpenAI-compatible API

<directory>
src/ - React 前端工作台入口与交互界面 (0子目录)
server/ - Node/Express 后端、服务与 SQLite 边界 (0子目录)
shared/ - 前后端共享 TypeScript 契约 (0子目录)
docs/ - 设计、规格、记忆与架构语义层 (3子目录: superpowers, daily, bank...)
e2e/ - Playwright 浏览器验收用例与逐步录证截图附件 (0子目录)
</directory>

<config>
AGENTS.md - L1 项目宪法，记录顶层目录、技术栈与文档协议
package.json - Node 工程脚本、运行依赖与开发依赖清单
index.html - Vite 前端入口 HTML，提供 #root 挂载点
vite.config.ts - Vite React 与 Vitest 浏览器环境配置
playwright.config.ts - Playwright e2e 配置，声明本地 Chrome 与 dev server 启动策略
tsconfig.json - 前端与共享契约 TypeScript 编译边界
tsconfig.node.json - 后端与工具配置 TypeScript 编译边界
.env.example - 本地端口、数据库、模型代理与爬虫配置样例
.gitignore - 忽略依赖、构建产物、本地数据、密钥与覆盖率输出
</config>

法则: 极简·稳定·导航·版本精确
