# Digital Mentor Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runnable local-first Digital Mentor Matrix: crawl evidence, store it in SQLite, distill persona skills, evaluate projects, and critique evaluations through an OpenAI-compatible backend proxy.

**Architecture:** The app is split into React frontend, Express backend, and SQLite storage. Backend route handlers stay thin and delegate to `researchService`, `libraryService`, `skillService`, `evaluationService`, and `modelService`. UI uses three persistent panels: people matrix, active workflow, and evidence/output.

**Tech Stack:** Vite, React, TypeScript, Node, Express, better-sqlite3, Vitest, React Testing Library, Playwright, Cheerio, Zod, OpenAI-compatible HTTP API.

---

## File Structure

Create these top-level areas:

- `src/`: React frontend.
- `server/`: Express backend, services, database, tests.
- `shared/`: shared TypeScript schemas and types.
- `docs/`: GEB docs, superpowers specs/plans, and project memory.

Planned files:

- `package.json`: scripts, dependencies, dev dependencies.
- `vite.config.ts`: Vite and Vitest browser-side configuration.
- `tsconfig.json`: shared TypeScript options.
- `tsconfig.node.json`: backend TypeScript options.
- `.env.example`: documented model and crawler config.
- `.gitignore`: ignores `.env`, database files, build output, `.superpowers`.
- `AGENTS.md`: L1 project constitution, updated as structure grows.
- `src/AGENTS.md`: L2 frontend map.
- `src/main.tsx`: React entry.
- `src/App.tsx`: app shell and panel composition.
- `src/styles.css`: dark dense workstation styling.
- `src/api/client.ts`: frontend API wrapper.
- `src/components/PeoplePanel.tsx`: left people matrix.
- `src/components/WorkflowTabs.tsx`: mode switch.
- `src/components/ResearchWorkspace.tsx`: crawl/research form and job state.
- `src/components/DistillWorkspace.tsx`: skill distillation UI.
- `src/components/EvaluateWorkspace.tsx`: project evaluation and critique UI.
- `src/components/EvidencePanel.tsx`: right evidence/output panel.
- `src/test/App.test.tsx`: frontend layout tests.
- `server/AGENTS.md`: L2 backend map.
- `server/index.ts`: server bootstrap.
- `server/app.ts`: Express app factory.
- `server/config.ts`: environment parsing.
- `server/db/connection.ts`: SQLite connection.
- `server/db/migrate.ts`: migration runner.
- `server/db/schema.sql`: database schema.
- `server/routes/healthRoutes.ts`: health endpoint.
- `server/routes/libraryRoutes.ts`: people/sources/fragments endpoints.
- `server/routes/researchRoutes.ts`: crawl job endpoint.
- `server/routes/skillRoutes.ts`: skill distillation endpoint.
- `server/routes/evaluationRoutes.ts`: evaluation and critique endpoints.
- `server/services/libraryService.ts`: people/sources/fragments persistence.
- `server/services/researchService.ts`: seed URL crawl, extraction, dedupe.
- `server/services/modelService.ts`: provider calls and fake-provider seam for tests.
- `server/services/skillService.ts`: skill prompt, citation mapping, persistence.
- `server/services/evaluationService.ts`: matrix evaluation and critique persistence.
- `server/test/*.test.ts`: backend service and route tests.
- `shared/AGENTS.md`: L2 shared contract map.
- `shared/schemas.ts`: Zod schemas and inferred types.
- `docs/MEMORY.md`: minimal core memory.
- `docs/daily/2026-06-01.md`: current session record.
- `docs/bank/world.md`, `docs/bank/experience.md`, `docs/bank/opinions.md`, `docs/bank/entities/.gitkeep`: memory bank seed.

---

### Task 1: Project Scaffold And GEB/Memories

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `.env.example`
- Create: `.gitignore`
- Modify: `AGENTS.md`
- Create: `src/AGENTS.md`
- Create: `server/AGENTS.md`
- Create: `shared/AGENTS.md`
- Create: `docs/MEMORY.md`
- Create: `docs/daily/2026-06-01.md`
- Create: `docs/bank/world.md`
- Create: `docs/bank/experience.md`
- Create: `docs/bank/opinions.md`
- Create: `docs/bank/entities/.gitkeep`

- [ ] **Step 1: Initialize git if missing**

Run:

```bash
git rev-parse --is-inside-work-tree || git init
```

Expected: either `true` or a new repository initialized in `/Volumes/SSD/code/brainpower`.

- [ ] **Step 2: Create package and TypeScript config**

Write `package.json`:

```json
{
  "scripts": {
    "dev": "concurrently \"npm:dev:server\" \"npm:dev:web\"",
    "dev:web": "vite --host 0.0.0.0",
    "dev:server": "tsx watch server/index.ts",
    "build": "tsc -p tsconfig.json && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.node.json --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "better-sqlite3": "^11.8.1",
    "cheerio": "^1.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "nanoid": "^5.0.9",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/better-sqlite3": "^7.6.12",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "concurrently": "^9.1.2",
    "jsdom": "^25.0.1",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vite": "^6.0.6",
    "vitest": "^2.1.8"
  }
}
```

Write `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "shared"]
}
```

Write `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["server", "shared", "vite.config.ts"]
}
```

Write `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:4174"
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"]
  }
});
```

- [ ] **Step 3: Create environment and ignore files**

Write `.env.example`:

```bash
PORT=4174
DATABASE_PATH=./data/brainpower.sqlite
MODEL_BASE_URL=https://api.openai.com/v1
MODEL_API_KEY=replace-with-local-secret
MODEL_NAME=gpt-4.1-mini
CRAWLER_USER_AGENT=brainpower-local-research/0.1
CRAWLER_RATE_LIMIT_MS=1200
```

Write `.gitignore`:

```gitignore
node_modules/
dist/
data/
.env
.DS_Store
.superpowers/
coverage/
```

- [ ] **Step 4: Update GEB docs and memory seed**

Update `AGENTS.md` so `<directory>` includes `src/`, `server/`, `shared/`, and `docs/`.

Create `src/AGENTS.md`, `server/AGENTS.md`, and `shared/AGENTS.md` with one-line file responsibilities and the exact protocol line:

```markdown
[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
```

Create `docs/MEMORY.md`:

```markdown
# Brainpower 开发记忆

## 用户画像
偏好中文沟通、工程边界清晰、代码与文档同构。

## 项目状态
正在从空目录构建数字高人矩阵本地 Web App。

## 活跃约束
必须执行 GEB 三层文档协议；首版做本地后端代理、全网可控采集、SQLite、本机单人使用、不做账号系统。

## 验证过的路径
先规格、再计划、再 TDD 实现；分表、分服务、分 UI 面板。
```

Create `docs/daily/2026-06-01.md`:

```markdown
# 2026-06-01

## 会话摘要
确认数字高人矩阵首版范围：本地 Web App、后端 AI 代理、可控爬取、SQLite、无账号系统。

## 记录
- [决策] 架构按前端、后端、SQLite 三层拆分。
- [决策] 后端按 research/library/skill/evaluation/model 五个服务拆分。
- [决策] UI 按人物矩阵、任务工作区、证据输出三面板拆分。
- [约束] 爬取遵守 robots、限速、不登录第三方、不绕过付费墙。

## Retain
- → MEMORY: 分表、分服务、分 UI 面板是本项目核心约束。
- → bank/experience: 数字人物输出必须带证据、置信度和诚实边界，避免变成无来源拟人表演。
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` created and install exits with code 0.

- [ ] **Step 6: Verify scaffold**

Run:

```bash
npm run lint
```

Expected: TypeScript reports no input files for not-yet-created app files or passes after Task 2 creates them. If it reports missing setup file, proceed to Task 2 where `src/test/setup.ts` is created.

- [ ] **Step 7: Commit scaffold**

Run:

```bash
git add .
git commit -m "chore: scaffold digital mentor matrix"
```

Expected: commit succeeds.

---

### Task 2: Shared Schemas And SQLite Migration

**Files:**
- Create: `shared/schemas.ts`
- Create: `server/db/schema.sql`
- Create: `server/db/connection.ts`
- Create: `server/db/migrate.ts`
- Create: `server/test/db.test.ts`
- Modify: `shared/AGENTS.md`
- Modify: `server/AGENTS.md`

- [ ] **Step 1: Write failing database migration test**

Create `server/test/db.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { openDatabase } from "../db/connection";
import { migrate } from "../db/migrate";

describe("database schema", () => {
  test("creates the core Digital Mentor Matrix tables", () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-db-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    migrate(db);

    const rows = db
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all() as Array<{ name: string }>;

    expect(rows.map((row) => row.name)).toEqual([
      "critiques",
      "evaluations",
      "fragments",
      "jobs",
      "people",
      "skills",
      "sources"
    ]);

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- server/test/db.test.ts
```

Expected: FAIL because `server/db/connection` does not exist.

- [ ] **Step 3: Implement shared schemas and migration**

Create `shared/schemas.ts` with L3 header and Zod schemas:

```ts
/**
 * [INPUT]: 依赖 zod 的运行时 schema 与类型推导能力
 * [OUTPUT]: 对外提供 PersonSchema、SourceSchema、FragmentSchema、SkillSchema、EvaluationSchema、CritiqueSchema、JobSchema 与类型
 * [POS]: shared 的契约中心，被前端 API client 与后端服务共同消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { z } from "zod";

export const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(["investor", "entrepreneur", "ai_builder"]),
  region: z.string(),
  tags: z.array(z.string()),
  status: z.enum(["needs_research", "researching", "ready_to_distill", "ready_to_evaluate"]),
  notes: z.string().optional()
});

export type Person = z.infer<typeof PersonSchema>;
```

Create the remaining schemas in the same file: `SourceSchema`, `FragmentSchema`, `SkillSchema`, `EvaluationSchema`, `CritiqueSchema`, and `JobSchema`. Use string ids and JSON arrays for structured model output.

Create `server/db/schema.sql` with the seven tables exactly named by the test.

Create `server/db/connection.ts`:

```ts
/**
 * [INPUT]: 依赖 better-sqlite3 创建同步 SQLite 连接
 * [OUTPUT]: 对外提供 openDatabase 函数
 * [POS]: server/db 的连接边界，被迁移器、服务与测试消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import Database from "better-sqlite3";

export function openDatabase(path: string) {
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  return db;
}
```

Create `server/db/migrate.ts`:

```ts
/**
 * [INPUT]: 依赖 fs 读取 schema.sql，依赖 better-sqlite3 执行 DDL
 * [OUTPUT]: 对外提供 migrate 函数
 * [POS]: server/db 的 schema 初始化器，被启动流程与测试消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";

const here = dirname(fileURLToPath(import.meta.url));

export function migrate(db: Database.Database) {
  const sql = readFileSync(join(here, "schema.sql"), "utf8");
  db.exec(sql);
}
```

- [ ] **Step 4: Run database test to verify it passes**

Run:

```bash
npm test -- server/test/db.test.ts
```

Expected: PASS.

- [ ] **Step 5: Update L2 docs**

Update `shared/AGENTS.md` with `schemas.ts`.

Update `server/AGENTS.md` with `db/connection.ts`, `db/migrate.ts`, `db/schema.sql`, and `test/db.test.ts`.

- [ ] **Step 6: Commit database foundation**

Run:

```bash
git add shared server docs AGENTS.md
git commit -m "feat: add sqlite schema foundation"
```

Expected: commit succeeds.

---

### Task 3: Express App, Config, And Library Service

**Files:**
- Create: `server/config.ts`
- Create: `server/app.ts`
- Create: `server/index.ts`
- Create: `server/routes/healthRoutes.ts`
- Create: `server/routes/libraryRoutes.ts`
- Create: `server/services/libraryService.ts`
- Create: `server/test/libraryService.test.ts`
- Create: `server/test/app.test.ts`
- Modify: `server/AGENTS.md`

- [ ] **Step 1: Write failing library service test**

Create `server/test/libraryService.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { openDatabase } from "../db/connection";
import { migrate } from "../db/migrate";
import { createLibraryService } from "../services/libraryService";

describe("libraryService", () => {
  test("creates a person and returns it in matrix order", () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-library-"));
    const db = openDatabase(join(dir, "test.sqlite"));
    migrate(db);
    const library = createLibraryService(db);

    const person = library.createPerson({
      name: "Peter Thiel",
      role: "investor",
      region: "US",
      tags: ["zero_to_one"],
      notes: "Contrarian investor"
    });

    expect(library.listPeople()).toEqual([person]);
    expect(person.status).toBe("needs_research");

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- server/test/libraryService.test.ts
```

Expected: FAIL because `libraryService` does not exist.

- [ ] **Step 3: Implement library service**

Create `server/services/libraryService.ts` with L3 header. Export `createLibraryService(db)` with these methods:

```ts
createPerson(input: {
  name: string;
  role: "investor" | "entrepreneur" | "ai_builder";
  region: string;
  tags: string[];
  notes?: string;
}): Person
listPeople(): Person[]
createSource(input: {
  personId: string;
  url: string;
  title: string;
  sourceType: string;
  trustLevel: string;
  crawlStatus: string;
}): Source
createFragment(input: {
  sourceId: string;
  personId: string;
  content: string;
  summary: string;
  timelineTag: string;
  evidenceType: string;
}): Fragment
listFragments(personId: string): Fragment[]
```

Use `nanoid()` for ids. Store `tags` as JSON text. Keep SQL in this file only for library entities.

- [ ] **Step 4: Run library service test to verify it passes**

Run:

```bash
npm test -- server/test/libraryService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing app route test**

Create `server/test/app.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createApp } from "../app";
import { openDatabase } from "../db/connection";
import { migrate } from "../db/migrate";

describe("app routes", () => {
  test("returns health and people list", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-app-"));
    const db = openDatabase(join(dir, "test.sqlite"));
    migrate(db);
    const app = createApp({ db });
    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;

    const health = await fetch(`http://127.0.0.1:${port}/api/health`).then((res) => res.json());
    const people = await fetch(`http://127.0.0.1:${port}/api/people`).then((res) => res.json());

    expect(health).toEqual({ ok: true });
    expect(people).toEqual([]);

    server.close();
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 6: Run app test to verify it fails**

Run:

```bash
npm test -- server/test/app.test.ts
```

Expected: FAIL because `server/app` does not exist.

- [ ] **Step 7: Implement Express app and routes**

Create `server/app.ts`, `server/index.ts`, `server/config.ts`, `server/routes/healthRoutes.ts`, and `server/routes/libraryRoutes.ts` with L3 headers.

`createApp({ db })` creates Express app, enables JSON and CORS, mounts:

- `GET /api/health`
- `GET /api/people`
- `POST /api/people`
- `GET /api/people/:personId/fragments`

Keep routes thin; instantiate `libraryService` and delegate.

- [ ] **Step 8: Run app route test to verify it passes**

Run:

```bash
npm test -- server/test/app.test.ts
```

Expected: PASS.

- [ ] **Step 9: Update L2 docs and commit**

Update `server/AGENTS.md` with config, app, index, route, service, and test files.

Run:

```bash
git add server docs AGENTS.md
git commit -m "feat: add backend app and library service"
```

Expected: commit succeeds.

---

### Task 4: Research Service With Seed URL Crawl

**Files:**
- Create: `server/services/researchService.ts`
- Create: `server/routes/researchRoutes.ts`
- Create: `server/test/researchService.test.ts`
- Modify: `server/app.ts`
- Modify: `server/AGENTS.md`

- [ ] **Step 1: Write failing research service test**

Create `server/test/researchService.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { openDatabase } from "../db/connection";
import { migrate } from "../db/migrate";
import { createLibraryService } from "../services/libraryService";
import { createResearchService } from "../services/researchService";

describe("researchService", () => {
  test("extracts readable text from a seed URL and dedupes repeated content", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-research-"));
    const db = openDatabase(join(dir, "test.sqlite"));
    migrate(db);
    const library = createLibraryService(db);
    const person = library.createPerson({ name: "徐新", role: "investor", region: "CN", tags: ["consumer"] });
    const html = "<html><head><title>Interview</title></head><body><main><h1>投资判断</h1><p>我首先看人，其次看赛道。</p></main></body></html>";
    const fetchPage = async () => ({ url: "https://example.com/xu", html });
    const service = createResearchService({ db, library, fetchPage });

    const first = await service.crawlSeedUrl({ personId: person.id, url: "https://example.com/xu" });
    const second = await service.crawlSeedUrl({ personId: person.id, url: "https://example.com/xu" });

    expect(first.fragments).toHaveLength(1);
    expect(second.fragments).toHaveLength(0);
    expect(library.listFragments(person.id)[0].content).toContain("我首先看人");

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- server/test/researchService.test.ts
```

Expected: FAIL because `researchService` does not exist.

- [ ] **Step 3: Implement research service**

Create `server/services/researchService.ts` with L3 header. Export `createResearchService({ db, library, fetchPage })`.

Behavior:

- `crawlSeedUrl({ personId, url })` creates a `jobs` row with type `crawl`.
- It fetches HTML through injected `fetchPage`.
- It extracts title and main readable text with Cheerio.
- It computes a content hash using Node `crypto`.
- It skips inserting fragments when the same URL or same content already exists.
- It writes `sources` and `fragments`.
- It updates the job to `succeeded` or `failed`.

- [ ] **Step 4: Run research service test to verify it passes**

Run:

```bash
npm test -- server/test/researchService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add route and app mount**

Create `server/routes/researchRoutes.ts` with `POST /api/research/crawl` accepting `{ personId, url }`.

Modify `server/app.ts` to mount research routes.

- [ ] **Step 6: Run all backend tests**

Run:

```bash
npm test -- server/test
```

Expected: all backend tests PASS.

- [ ] **Step 7: Update L2 docs and commit**

Update `server/AGENTS.md`.

Run:

```bash
git add server docs AGENTS.md
git commit -m "feat: add seed url research crawler"
```

Expected: commit succeeds.

---

### Task 5: Model, Skill, Evaluation, And Critique Services

**Files:**
- Create: `server/services/modelService.ts`
- Create: `server/services/skillService.ts`
- Create: `server/services/evaluationService.ts`
- Create: `server/routes/skillRoutes.ts`
- Create: `server/routes/evaluationRoutes.ts`
- Create: `server/test/modelService.test.ts`
- Create: `server/test/skillService.test.ts`
- Create: `server/test/evaluationService.test.ts`
- Modify: `server/app.ts`
- Modify: `server/AGENTS.md`

- [ ] **Step 1: Write failing model service test**

Create `server/test/modelService.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { createModelService } from "../services/modelService";

describe("modelService", () => {
  test("sends OpenAI-compatible chat requests and returns text", async () => {
    const requests: unknown[] = [];
    const fetchJson = async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(init.body as string));
      return { choices: [{ message: { content: "{\"verdict\":\"pass\"}" } }] };
    };
    const model = createModelService({
      baseUrl: "https://models.example/v1",
      apiKey: "secret",
      modelName: "test-model",
      fetchJson
    });

    const text = await model.completeJson("system", "user");

    expect(text).toBe("{\"verdict\":\"pass\"}");
    expect(requests).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run model test to verify it fails**

Run:

```bash
npm test -- server/test/modelService.test.ts
```

Expected: FAIL because `modelService` does not exist.

- [ ] **Step 3: Implement model service**

Create `server/services/modelService.ts` with `createModelService({ baseUrl, apiKey, modelName, fetchJson })`.

Expose:

```ts
completeJson(systemPrompt: string, userPrompt: string): Promise<string>
```

It sends `POST {baseUrl}/chat/completions` with model, messages, and `response_format: { type: "json_object" }`. It returns `choices[0].message.content`.

- [ ] **Step 4: Write failing skill service test**

Create `server/test/skillService.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { openDatabase } from "../db/connection";
import { migrate } from "../db/migrate";
import { createLibraryService } from "../services/libraryService";
import { createSkillService } from "../services/skillService";

describe("skillService", () => {
  test("stores a citation-aware skill for a person", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-skill-"));
    const db = openDatabase(join(dir, "test.sqlite"));
    migrate(db);
    const library = createLibraryService(db);
    const person = library.createPerson({ name: "Peter Thiel", role: "investor", region: "US", tags: ["contrarian"] });
    const source = library.createSource({ personId: person.id, url: "https://example.com", title: "Interview", sourceType: "interview", trustLevel: "medium", crawlStatus: "succeeded" });
    const fragment = library.createFragment({ sourceId: source.id, personId: person.id, content: "Competition is for losers.", summary: "Contrarian monopoly thesis", timelineTag: "career", evidenceType: "thesis" });
    const model = { completeJson: async () => JSON.stringify({
      mentalModels: ["seek monopoly"],
      heuristics: ["avoid crowded markets"],
      voiceDna: ["contrarian"],
      antiPatterns: ["commodity competition"],
      honestyBoundaries: ["public quote only"],
      citations: [fragment.id]
    }) };
    const service = createSkillService({ db, library, model });

    const skill = await service.distillPersonSkill(person.id);

    expect(skill.personId).toBe(person.id);
    expect(skill.citations).toEqual([fragment.id]);

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 5: Implement skill service and route**

Create `server/services/skillService.ts` with `distillPersonSkill(personId)`.

Create `server/routes/skillRoutes.ts` with `POST /api/skills/distill`.

Skill persistence must reject citations that do not match existing fragment ids for that person.

- [ ] **Step 6: Write failing evaluation service test**

Create `server/test/evaluationService.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { openDatabase } from "../db/connection";
import { migrate } from "../db/migrate";
import { createEvaluationService } from "../services/evaluationService";

describe("evaluationService", () => {
  test("stores one evaluation per selected persona and a critique record", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-eval-"));
    const db = openDatabase(join(dir, "test.sqlite"));
    migrate(db);
    const model = { completeJson: async () => JSON.stringify({
      verdict: "pass",
      personJudgment: "founder insight is thin",
      businessJudgment: "market exists but wedge is weak",
      risks: ["distribution"],
      questions: ["why now"],
      score: { conviction: 42 },
      critique: "Not sharp enough."
    }) };
    const service = createEvaluationService({ db, model });

    const evaluation = await service.evaluateProject({
      project: { title: "AI founder OS", brief: "A cognition tool for founders." },
      personId: "person_a",
      skillId: "skill_a"
    });
    const critique = await service.critiqueEvaluation({
      evaluationId: evaluation.id,
      criticPersonId: "person_b",
      targetPersonId: "person_a"
    });

    expect(evaluation.verdict).toBe("pass");
    expect(critique.evaluationId).toBe(evaluation.id);

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 7: Implement evaluation service and routes**

Create `server/services/evaluationService.ts` with:

```ts
evaluateProject(input: { project: { title: string; brief: string }; personId: string; skillId: string }): Promise<Evaluation>
critiqueEvaluation(input: { evaluationId: string; criticPersonId: string; targetPersonId: string }): Promise<Critique>
```

Create `server/routes/evaluationRoutes.ts`:

- `POST /api/evaluations`
- `POST /api/critiques`

- [ ] **Step 8: Run service tests**

Run:

```bash
npm test -- server/test/modelService.test.ts server/test/skillService.test.ts server/test/evaluationService.test.ts
```

Expected: PASS.

- [ ] **Step 9: Mount routes, update docs, commit**

Modify `server/app.ts` to mount skill and evaluation routes.

Update `server/AGENTS.md`.

Run:

```bash
git add server docs AGENTS.md
git commit -m "feat: add model skill and evaluation services"
```

Expected: commit succeeds.

---

### Task 6: Frontend Three-Panel Workstation

**Files:**
- Create: `src/test/setup.ts`
- Create: `src/test/App.test.tsx`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/api/client.ts`
- Create: `src/components/PeoplePanel.tsx`
- Create: `src/components/WorkflowTabs.tsx`
- Create: `src/components/ResearchWorkspace.tsx`
- Create: `src/components/DistillWorkspace.tsx`
- Create: `src/components/EvaluateWorkspace.tsx`
- Create: `src/components/EvidencePanel.tsx`
- Modify: `src/AGENTS.md`

- [ ] **Step 1: Write failing frontend layout test**

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `src/test/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { App } from "../App";

describe("App", () => {
  test("renders the three-panel matrix workstation and switches workflows", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Digital High-Mind Matrix/i })).toBeInTheDocument();
    expect(screen.getByLabelText("People matrix")).toBeInTheDocument();
    expect(screen.getByLabelText("Workflow workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("Evidence and output")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Distill" }));
    expect(screen.getByText(/Citation-aware skill distillation/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Evaluate" }));
    expect(screen.getByText(/Project brief/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run frontend test to verify it fails**

Run:

```bash
npm test -- src/test/App.test.tsx
```

Expected: FAIL because `src/App` does not exist.

- [ ] **Step 3: Implement app shell and components**

Create every frontend file with L3 headers.

`src/App.tsx` owns only:

- active workflow state;
- seed display data;
- panel composition.

`PeoplePanel` renders seed people:

- Peter Thiel;
- 沈南鹏;
- 徐新;
- Elon Musk;
- 黄仁勋.

`WorkflowTabs` exposes `Research`, `Distill`, `Evaluate` buttons.

`ResearchWorkspace` includes inputs for person, seed URL, keywords, and crawl depth.

`DistillWorkspace` includes selected person, evidence count, and distill button.

`EvaluateWorkspace` includes project brief fields and matrix run button.

`EvidencePanel` shows source fragments, skill citations, verdicts, and empty critique-chain states.

Use `src/styles.css` for the dark dense workstation. Use fixed panel layout with responsive collapse under `900px`.

- [ ] **Step 4: Run frontend test to verify it passes**

Run:

```bash
npm test -- src/test/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Build app**

Run:

```bash
npm run build
```

Expected: Vite build exits with code 0 and writes `dist/`.

- [ ] **Step 6: Update L2 docs and commit**

Update `src/AGENTS.md`.

Run:

```bash
git add src docs AGENTS.md vite.config.ts tsconfig.json package.json package-lock.json
git commit -m "feat: add matrix workstation frontend"
```

Expected: commit succeeds.

---

### Task 7: Vertical Slice Wiring And Browser Verification

**Files:**
- Modify: `src/api/client.ts`
- Modify: `src/components/ResearchWorkspace.tsx`
- Modify: `src/components/DistillWorkspace.tsx`
- Modify: `src/components/EvaluateWorkspace.tsx`
- Modify: `src/components/EvidencePanel.tsx`
- Modify: `server/app.ts`
- Modify: `docs/AGENTS.md`, `src/AGENTS.md`, `server/AGENTS.md` if responsibilities change

- [ ] **Step 1: Write failing integration behavior test**

Add to `src/test/App.test.tsx`:

```tsx
test("submits a crawl request through the API client seam", async () => {
  const calls: Array<{ personId: string; url: string }> = [];
  render(<App api={{ crawlSeedUrl: async (input) => { calls.push(input); return { fragments: [] }; } }} />);

  await userEvent.type(screen.getByLabelText("Seed URL"), "https://example.com/interview");
  await userEvent.click(screen.getByRole("button", { name: "Start crawl" }));

  expect(calls[0].url).toBe("https://example.com/interview");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/test/App.test.tsx
```

Expected: FAIL because `App` does not accept an API seam or Research form is not wired.

- [ ] **Step 3: Implement frontend API seam**

Modify `src/App.tsx` to accept optional `api` prop. Default to `createApiClient()`.

Modify `src/api/client.ts` to export:

```ts
export type ApiClient = {
  crawlSeedUrl(input: { personId: string; url: string }): Promise<{ fragments: unknown[] }>;
  distillSkill(input: { personId: string }): Promise<unknown>;
  evaluateProject(input: { title: string; brief: string; personIds: string[] }): Promise<unknown>;
};
```

Wire `ResearchWorkspace` to call `api.crawlSeedUrl`.

- [ ] **Step 4: Run integration behavior test**

Run:

```bash
npm test -- src/test/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands exit with code 0.

- [ ] **Step 6: Start dev server**

Run:

```bash
npm run dev
```

Expected: Vite URL and backend server are available. Keep the session running for browser verification.

- [ ] **Step 7: Browser verify the app**

Open the Vite URL in Browser. Verify:

- first screen is the workstation;
- no marketing hero appears;
- left people panel, center workflow, and right evidence panel are visible;
- Research, Distill, and Evaluate tabs switch without overlap;
- text fits on desktop and mobile widths.

- [ ] **Step 8: Update docs and commit**

Run:

```bash
git add .
git commit -m "feat: wire vertical slice workstation"
```

Expected: commit succeeds.

---

## Self-Review

Spec coverage:

- Local-first web app: Task 1, Task 3, Task 6.
- Backend proxy: Task 3 and Task 5.
- SQLite tables: Task 2.
- Crawler boundary: Task 4.
- Skill distillation with citations: Task 5.
- Evaluation and critique: Task 5.
- Three-panel UI: Task 6.
- Error/job model: Task 2 schema and Task 4 service behavior.
- GEB docs and memory: Task 1 plus per-task doc updates.
- Verification scripts: Task 1 and Task 7.

Known scope discipline:

- No account system.
- No paid-wall bypass.
- No third-party login crawling.
- Search discovery can be added behind `researchService`; first vertical slice proves seed URL crawl.

Plan scan is clean. Function names are stable across tasks: `openDatabase`, `migrate`, `createLibraryService`, `createResearchService`, `createModelService`, `createSkillService`, `createEvaluationService`, and `createApiClient`.
