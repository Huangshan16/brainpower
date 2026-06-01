# World

## 项目事实
- Brainpower 是本地优先的数字高人矩阵 Web App。
- 技术栈为 React、TypeScript、Node/Express、SQLite、OpenAI-compatible API。
- 首版边界是不做账号系统，本机单人使用。
- SQLite 基础 schema 固定七张核心表：people、sources、fragments、skills、evaluations、critiques、jobs。
- Vite 开发代理的 `/api` 真相源跟随 `.env` 的 `PORT`，当前本地环境是 `4174`。
