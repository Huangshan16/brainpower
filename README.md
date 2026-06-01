# Brainpower

一个面向创业者、研究者与产品判断场景的本地优先 Web 工作台，用来构建“数字投资人矩阵 + 数字企业家矩阵”，把公开资料蒸馏为可调用的判断框架，并围绕具体项目进行多角色评审、交叉批判与证据追溯。

## 项目定位

这个项目不是聊天机器人壳子，也不是单纯的 prompt 集合。它解决的是一个更具体的问题：

- 如何把顶级投资人、企业家公开可得的传记、采访、演讲、复盘与投资逻辑整理为结构化判断模型
- 如何让这些判断模型以工作台的形式参与真实项目评审，而不是停留在文本收藏
- 如何让每条结论都尽量回到证据，而不是沦为无来源的“拟人扮演”

当前仓库聚焦首版单机闭环：本地运行、本地数据库、本地研究资料、本地模型代理，不做账号系统。

## 当前能力

### 1. 人物矩阵工作台

- 左侧人物矩阵：展示投资人 / 企业家画像、状态与标签
- 中央工作区：`Research`、`Distill`、`Evaluate` 三段工作流
- 右侧证据面板：集中显示片段数量、Skill 引用、投决结果与 critique 链占位

### 2. 资料研究与采集

- 输入种子 URL 发起研究任务
- 抓取网页正文并抽取资料片段
- 通过 URL 去重 + 正文内容去重降低重复噪声
- 采集过程写入本地 SQLite

### 3. Skill 蒸馏

- 从人物资料片段蒸馏 Skill
- Skill 结构包含：
  - mental models
  - heuristics
  - voice DNA
  - anti-patterns
  - honesty boundaries
  - citations

### 4. 项目评审

- 输入项目标题与 brief
- 选择数字人物发起评审
- 后端通过 OpenAI-compatible API 代理模型调用
- 评审结果持久化为 evaluations / critiques

### 5. 测试与浏览器录证

- Vitest：覆盖服务层与前端 seam
- Playwright：真实浏览器逐个点击 `Research / Distill / Evaluate`
- e2e 用例附带逐步截图证据，避免“手工点过了但无法复现”

## 当前边界

这个仓库已经能跑通首版产品骨架，但还不是生产系统。以下内容当前未实现或未完善：

- 多用户与权限系统
- 账号登录、团队协作、云端同步
- 大规模搜索引擎接入与任务编排
- 自动化长链路资料清洗流水线
- 生产级审计、限流、观测与部署方案
- 完整的前端-后端联调体验打磨

如果你要把它当成公开 SaaS 直接上线，技术边界还远远不够。当前更适合本地研究型工具与开源原型演进。

## 开源许可

本项目采用 `MIT License`。

你可以自由使用、修改、分发和二次开发，但需要保留原始版权与许可声明。

## 技术栈

- 前端：React 19 + TypeScript + Vite
- 后端：Node.js + Express + TypeScript
- 数据库：SQLite + better-sqlite3
- 契约：Zod
- 测试：Vitest + Playwright
- 模型接入：OpenAI-compatible Chat Completions API
- 采集解析：Cheerio

## 系统架构

```text
brainpower/
├── src/               # React 前端工作台
├── server/            # Express API、服务层、SQLite 边界
├── shared/            # 前后端共享契约
├── e2e/               # Playwright 浏览器录证测试
├── docs/              # 规格、计划、记忆与架构文档
├── playwright.config.ts
├── vite.config.ts
└── package.json
```

核心分层：

1. **Frontend Matrix Console**
   - 负责人物矩阵、工作流切换与证据面板
2. **Backend Service Layer**
   - `researchService`
   - `libraryService`
   - `skillService`
   - `evaluationService`
   - `modelService`
3. **SQLite Local Storage**
   - `people`
   - `sources`
   - `fragments`
   - `skills`
   - `evaluations`
   - `critiques`
   - `jobs`

项目的核心约束是：**分表、分服务、分 UI 面板**。
这不是文档口号，而是防止研究任务、资料片段、Skill 蒸馏、评审输出互相污染的必要边界。

## 快速开始

### 环境要求

- Node.js 20+
- npm 10+
- 本地可用的 Chrome（用于 Playwright `channel: "chrome"` e2e）

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制一份环境变量模板：

```bash
cp .env.example .env
```

然后按需修改：

```env
PORT=4174
DATABASE_PATH=./data/brainpower.sqlite
MODEL_BASE_URL=https://api.openai.com/v1
MODEL_API_KEY=replace-with-local-secret
MODEL_NAME=gpt-4.1-mini
MODEL_TIMEOUT_MS=30000
LOG_FILE_PATH=logs/backend.ndjson
CRAWLER_USER_AGENT=brainpower-local-research/0.1
CRAWLER_RATE_LIMIT_MS=1200
```

### 3. 启动开发环境

```bash
npm run dev
```

默认会同时启动：

- 前端：Vite dev server
- 后端：Express + `tsx watch`

### 4. 打开应用

浏览器访问：

```text
http://localhost:5173/
```

## 环境变量说明

| 变量名                    | 说明                         | 默认值                            |
| ------------------------- | ---------------------------- | --------------------------------- |
| `PORT`                  | 后端服务端口                 | `4174`                          |
| `DATABASE_PATH`         | SQLite 文件路径              | `./data/brainpower.sqlite`      |
| `MODEL_BASE_URL`        | OpenAI-compatible API 基地址 | `https://api.openai.com/v1`     |
| `MODEL_API_KEY`         | 模型 API Key                 | 无                                |
| `MODEL_NAME`            | 默认模型名                   | `gpt-4.1-mini`                  |
| `MODEL_TIMEOUT_MS`      | 单次模型请求超时毫秒数       | `30000`                         |
| `LOG_FILE_PATH`         | 后端结构化日志文件路径       | `logs/backend.ndjson`           |
| `CRAWLER_USER_AGENT`    | 采集请求 User-Agent          | `brainpower-local-research/0.1` |
| `CRAWLER_RATE_LIMIT_MS` | 采集限速间隔                 | `1200`                          |

## 可用脚本

```bash
npm run dev         # 同时启动前后端开发服务
npm run build       # 构建前端产物
npm test            # 运行 Vitest 单元/集成测试
npm run test:e2e    # 运行 Playwright 浏览器录证测试
npm run lint        # TypeScript 类型检查
```

## 测试策略

### Vitest

用于验证：

- 后端 service 边界
- 路由与共享契约
- 前端三面板骨架
- API seam 行为

### Playwright

用于验证：

- 浏览器真实渲染
- workflow tab 逐个点击切换
- 页面级截图录证

这是两个不同层次的测试：

- Vitest 负责逻辑回归
- Playwright 负责真实浏览器交互证据

不要把它们混成一个大杂烩。测试边界混乱，会让失败信号失真。

## 数据与模型设计原则

### 1. 证据优先

任何“数字人物”的输出都应尽量附带引用、证据与诚实边界。
没有来源的强判断，很容易从研究工具滑向表演工具。

### 2. 快照优先于过度外键

像 `evaluations.person_id`、`skill_id` 这类评审上下文字段，在首版中更适合作为快照保留；真正不可替代的关系再上强外键。
否则演进和测试都会被数据库约束绑死。

### 3. 特殊情况尽量通过结构消失

例如：

- source 负责 URL 归属
- fragment 负责正文片段
- service 负责 SQL 与规则
- route 只做薄边界

这比在每一层堆条件分支更稳。

## 目录说明

### `src/`

前端工作台，负责：

- 人物矩阵
- 工作流切换
- Research / Distill / Evaluate 三类工作区
- 证据输出面板

### `server/`

后端 API 与服务层，负责：

- 资料抓取
- 本地数据读写
- Skill 蒸馏
- 项目评审
- 模型代理

## License

详见根目录的 [LICENSE](./LICENSE)。

### `shared/`

前后端共享 Zod schema 与数据契约，避免字段命名漂移。

### `e2e/`

Playwright 浏览器录证测试，负责真实交互层验收。

### `docs/`

项目的规格、计划、记忆与架构镜像。
这个仓库执行 GEB 分形文档协议：代码结构变化，文档必须同步变化。

## 已知问题

- 当前 `vite.config.ts` 的 `/api` 代理配置需要与后端实际监听端口保持一致，否则联调时会出现代理拒绝连接。
- 首版 UI 已能展示完整骨架，但真实模型输出与资料蒸馏仍有进一步打磨空间。
- “全网爬取”当前是可控采集，不是无限制搜索引擎爬虫。

## 贡献方式

欢迎以 issue / PR 形式参与，但请先理解这个项目的边界：

1. 这是一个研究型工具，不接受把它改成“万能聊天壳子”的 PR
2. 新增模块时请保持 `分表、分服务、分 UI 面板`
3. 架构级变更必须同步更新 `AGENTS.md`
4. 不要提交真实密钥、数据库文件或临时测试产物

如果你要做较大改动，建议先在 issue 里对齐目标和边界，再进入实现。

## Roadmap

- [ ] 补齐真实研究资料导入工作流
- [ ] 完善 Skill 蒸馏结果展示
- [ ] 完善 evaluation / critique 链路的前端反馈
- [ ] 打通前后端联调默认配置
- [ ] 增加更多 e2e 浏览器录证场景
