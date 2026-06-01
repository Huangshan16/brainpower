# Persona Library And Conversation Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import real personas from `nuwa-skill`, add a `nuwa-skill` gateway for distillation jobs, and replace the old evaluation page with a conversation workspace that supports adding personas, direct chat, group chat, and stopping group chat.

**Architecture:** Extend the current local-first app in three layers. Backend grows new persona-library, `nuwaGateway`, conversation, and conversation-run services on top of the existing SQLite and model service seams. Frontend keeps the three-panel workstation shape, but replaces `EvaluateWorkspace` with a composed conversation UI that consumes local persona and conversation snapshots rather than external engine runtime state.

**Tech Stack:** Vite, React, TypeScript, Express, better-sqlite3, Vitest, React Testing Library, Playwright, Node child-process integration, Zod.

---

## File Structure

Keep existing directories and add focused files instead of bloating current modules.

- `shared/schemas.ts`: expand contracts for personas, jobs, conversations, participants, messages, and runs.
- `server/db/schema.sql`: add new persona metadata fields and conversation tables.
- `server/services/personaLibraryService.ts`: persona CRUD, search, archive, soft delete, import dedupe.
- `server/services/nuwaGatewayService.ts`: import existing personas from `nuwa-skill`, and provide a seam for future CLI distillation runs.
- `server/services/distillationService.ts`: normalize gateway output into local tables and optional conversation join.
- `server/services/conversationService.ts`: conversation CRUD and participant management.
- `server/services/conversationRunService.ts`: direct/group run state, group stop semantics, round orchestration.
- `server/routes/personaRoutes.ts`: persona library, import, delete, and distill endpoints.
- `server/routes/conversationRoutes.ts`: conversation, participant, message, direct/group/stop run endpoints.
- `server/test/personaLibraryService.test.ts`: import/delete/search behavior.
- `server/test/nuwaGatewayService.test.ts`: real-persona import normalization seam.
- `server/test/conversationService.test.ts`: participant and conversation persistence.
- `server/test/conversationRunService.test.ts`: direct/group/stop behavior.
- `src/api/client.ts`: add persona and conversation API methods.
- `src/App.tsx`: load personas from backend and rename `Evaluate` workflow to `Conversation`.
- `src/components/ConversationWorkspace.tsx`: new third-pane shell.
- `src/components/ConversationHeader.tsx`: title, mode, run state, stop button.
- `src/components/ParticipantTray.tsx`: active participants with remove controls.
- `src/components/MessageTimeline.tsx`: chat transcript renderer.
- `src/components/Composer.tsx`: input box and `发送 / 单聊 / 群聊 / 终止群聊`.
- `src/components/PersonaPicker.tsx`: add personas from the library into the current conversation.
- `src/components/JobPanel.tsx`: import, distill, and run status summary.
- `src/components/WorkflowTabs.tsx`: rename `评审` to `对话`.
- `src/test/App.test.tsx`: update workflow expectations and right-panel behavior.
- `src/test/ConversationWorkspace.test.tsx`: add, send, mode switch, stop group chat.
- `e2e/workflow-tabs.spec.ts`: update third tab text and verify conversation UI.
- `e2e/conversation-flow.spec.ts`: import personas, add participants, send, group chat, stop.
- `docs/daily/2026-06-01.md`, `docs/bank/experience.md`, `src/components/AGENTS.md`, `server/AGENTS.md`, `e2e/AGENTS.md`: keep GEB and memory aligned.

Scope check: this spec touches import, distillation seam, and conversation UI, but they are one coupled vertical slice because the chat page depends on imported personas and local skill snapshots. It does not need separate plans.

---

### Task 1: Expand Shared Contracts And Database Schema

**Files:**
- Modify: `shared/schemas.ts`
- Modify: `server/db/schema.sql`
- Modify: `server/db/migrate.ts`
- Test: `server/test/db.test.ts`

- [ ] **Step 1: Write the failing schema test for new tables and fields**

Update `server/test/db.test.ts` with assertions like:

```ts
test("creates persona metadata fields and conversation tables", () => {
  const db = createInMemoryDatabase();
  runMigrations(db);

  const peopleColumns = db.prepare("pragma table_info(people)").all() as Array<{ name: string }>;
  const conversationColumns = db.prepare("pragma table_info(conversations)").all() as Array<{ name: string }>;
  const participantColumns = db.prepare("pragma table_info(conversation_participants)").all() as Array<{ name: string }>;

  expect(peopleColumns.map((column) => column.name)).toEqual(
    expect.arrayContaining(["origin_type", "origin_ref", "persona_kind", "is_archived", "is_deleted"])
  );
  expect(conversationColumns.map((column) => column.name)).toEqual(
    expect.arrayContaining(["id", "title", "mode", "status", "created_at", "updated_at"])
  );
  expect(participantColumns.map((column) => column.name)).toEqual(
    expect.arrayContaining(["conversation_id", "person_id", "skill_id", "join_source", "position", "is_active"])
  );
});
```

- [ ] **Step 2: Run the db test to verify it fails**

Run:

```bash
npm test -- server/test/db.test.ts
```

Expected: FAIL because the new columns and tables do not exist yet.

- [ ] **Step 3: Extend shared Zod contracts**

Add contract shapes in `shared/schemas.ts`:

```ts
export const PersonaSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  region: z.string(),
  status: z.string(),
  tags: z.array(z.string()),
  originType: z.enum(["seed", "nuwa_import", "manual", "distilled"]),
  originRef: z.string().nullable(),
  personaKind: z.enum(["person", "topic"]),
  isArchived: z.boolean(),
  isDeleted: z.boolean()
});

export const ConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  mode: z.enum(["direct", "group"]),
  status: z.enum(["active", "stopped", "archived"]),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderType: z.enum(["user", "persona", "system"]),
  senderId: z.string(),
  content: z.string(),
  roundIndex: z.number().int().nonnegative(),
  replyToMessageId: z.string().nullable(),
  meta: z.record(z.any()).default({}),
  createdAt: z.string()
});
```

- [ ] **Step 4: Extend SQLite schema minimally**

Add to `server/db/schema.sql`:

```sql
alter table people add column origin_type text not null default 'seed';
alter table people add column origin_ref text;
alter table people add column persona_kind text not null default 'person';
alter table people add column is_archived integer not null default 0;
alter table people add column is_deleted integer not null default 0;

create table if not exists conversations (
  id text primary key,
  title text not null,
  mode text not null,
  status text not null,
  created_at text not null,
  updated_at text not null
);

create table if not exists conversation_participants (
  conversation_id text not null,
  person_id text not null,
  skill_id text not null,
  join_source text not null,
  position integer not null,
  is_active integer not null default 1,
  primary key (conversation_id, person_id, skill_id)
);
```

- [ ] **Step 5: Keep migration runner idempotent**

In `server/db/migrate.ts`, guard additive migration statements:

```ts
const columns = new Set(
  (db.prepare("pragma table_info(people)").all() as Array<{ name: string }>).map((column) => column.name)
);

if (!columns.has("origin_type")) {
  db.exec("alter table people add column origin_type text not null default 'seed'");
}
```

- [ ] **Step 6: Run the db test to verify it passes**

Run:

```bash
npm test -- server/test/db.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add shared/schemas.ts server/db/schema.sql server/db/migrate.ts server/test/db.test.ts
git commit -m "feat: add persona and conversation schema"
```

---

### Task 2: Add Persona Library And `nuwa-skill` Gateway Services

**Files:**
- Create: `server/services/personaLibraryService.ts`
- Create: `server/services/nuwaGatewayService.ts`
- Create: `server/routes/personaRoutes.ts`
- Modify: `server/app.ts`
- Modify: `server/AGENTS.md`
- Test: `server/test/personaLibraryService.test.ts`
- Test: `server/test/nuwaGatewayService.test.ts`
- Test: `server/test/app.test.ts`

- [ ] **Step 1: Write failing persona-library tests**

Create `server/test/personaLibraryService.test.ts`:

```ts
test("imports real personas without duplicating existing entries", async () => {
  const service = createPersonaLibraryService(db);

  service.upsertImportedPersonas([
    { name: "Paul Graham", role: "创业者", region: "US", tags: ["startup"], originRef: "nuwa-skill:paul-graham" },
    { name: "Paul Graham", role: "创业者", region: "US", tags: ["startup"], originRef: "nuwa-skill:paul-graham" }
  ]);

  expect(service.listPeople().filter((person) => person.name === "Paul Graham")).toHaveLength(1);
});

test("soft deletes a persona without removing row history", () => {
  const service = createPersonaLibraryService(db);
  const person = service.createManualPersona({ name: "临时人物", role: "观察者" });

  service.softDeletePersona(person.id);

  expect(service.listPeople().find((entry) => entry.id === person.id)?.isDeleted).toBe(true);
});
```

- [ ] **Step 2: Write failing gateway import test**

Create `server/test/nuwaGatewayService.test.ts`:

```ts
test("normalizes nuwa persona list into importable library rows", async () => {
  const gateway = createNuwaGatewayService({
    fetchReadme: async () => `
## 已蒸馏人物
- Paul Graham
- 张一鸣
- Karpathy
`
  });

  const personas = await gateway.listImportedPersonas();

  expect(personas.map((persona) => persona.name)).toEqual(
    expect.arrayContaining(["Paul Graham", "张一鸣", "Karpathy"])
  );
});
```

- [ ] **Step 3: Run service tests to verify they fail**

Run:

```bash
npm test -- server/test/personaLibraryService.test.ts server/test/nuwaGatewayService.test.ts
```

Expected: FAIL because services and route seam do not exist.

- [ ] **Step 4: Implement persona library service**

Create `server/services/personaLibraryService.ts` with focused methods:

```ts
export function createPersonaLibraryService(db: Database.Database) {
  return {
    listPeople() { /* select non-deleted by default */ },
    createManualPersona(input: { name: string; role: string; region?: string }) { /* insert */ },
    upsertImportedPersonas(input: ImportedPersonaInput[]) { /* dedupe by origin_ref then name */ },
    softDeletePersona(personId: string) { /* update is_deleted = 1 */ }
  };
}
```

- [ ] **Step 5: Implement `nuwa-skill` gateway import seam**

Create `server/services/nuwaGatewayService.ts`:

```ts
export function createNuwaGatewayService(deps?: { fetchReadme?: () => Promise<string> }) {
  const fetchReadme = deps?.fetchReadme ?? defaultFetchReadme;

  return {
    async listImportedPersonas() {
      const readme = await fetchReadme();
      const section = readme.split("## 已蒸馏人物")[1] ?? "";
      return section
        .split("\n")
        .filter((line) => line.trim().startsWith("- "))
        .map((line) => line.replace(/^- /, "").trim())
        .filter(Boolean)
        .map((name) => ({
          name,
          role: "真实人物",
          region: "未知",
          tags: ["nuwa-import"],
          originType: "nuwa_import" as const,
          originRef: `nuwa-skill:${name}`
        }));
    }
  };
}
```

- [ ] **Step 6: Add persona routes and app wiring**

Create `server/routes/personaRoutes.ts`:

```ts
router.get("/personas", (_req, res) => {
  res.json({ people: personaLibrary.listPeople() });
});

router.post("/personas/import/nuwa", async (_req, res) => {
  const imported = await nuwaGateway.listImportedPersonas();
  const result = personaLibrary.upsertImportedPersonas(imported);
  res.status(202).json({ imported: result });
});

router.delete("/personas/:id", (req, res) => {
  personaLibrary.softDeletePersona(req.params.id);
  res.status(204).send();
});
```

Wire it in `server/app.ts`.

- [ ] **Step 7: Extend app route test**

Add to `server/test/app.test.ts`:

```ts
test("imports nuwa personas and lists them through persona routes", async () => {
  const response = await request(app).post("/api/personas/import/nuwa").send();
  expect(response.status).toBe(202);

  const list = await request(app).get("/api/personas");
  expect(list.body.people.length).toBeGreaterThan(0);
});
```

- [ ] **Step 8: Run tests to verify they pass**

Run:

```bash
npm test -- server/test/personaLibraryService.test.ts server/test/nuwaGatewayService.test.ts server/test/app.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add server/services/personaLibraryService.ts server/services/nuwaGatewayService.ts server/routes/personaRoutes.ts server/app.ts server/AGENTS.md server/test/personaLibraryService.test.ts server/test/nuwaGatewayService.test.ts server/test/app.test.ts
git commit -m "feat: add persona library and nuwa import gateway"
```

---

### Task 3: Add Distillation And Conversation Backend

**Files:**
- Create: `server/services/distillationService.ts`
- Create: `server/services/conversationService.ts`
- Create: `server/services/conversationRunService.ts`
- Create: `server/routes/conversationRoutes.ts`
- Modify: `server/routes/skillRoutes.ts`
- Modify: `server/app.ts`
- Modify: `server/AGENTS.md`
- Test: `server/test/conversationService.test.ts`
- Test: `server/test/conversationRunService.test.ts`

- [ ] **Step 1: Write failing conversation tests**

Create `server/test/conversationService.test.ts`:

```ts
test("adds and removes participants from a conversation using skill snapshots", () => {
  const service = createConversationService(db);
  const conversation = service.createConversation({ title: "创业判断", mode: "group" });

  service.addParticipant({
    conversationId: conversation.id,
    personId: "paul",
    skillId: "skill_paul_v1",
    joinSource: "library"
  });

  service.removeParticipant(conversation.id, "paul", "skill_paul_v1");

  expect(service.listParticipants(conversation.id)).toHaveLength(0);
});
```

Create `server/test/conversationRunService.test.ts`:

```ts
test("stops an active group run without deleting messages", async () => {
  const runs = createConversationRunService({ db, model });
  const run = await runs.startGroupRun({ conversationId: "conv_1", messageId: "msg_1" });

  await runs.stopRun(run.id, "user_stop");

  expect(runs.getRun(run.id)?.status).toBe("stopped");
});
```

- [ ] **Step 2: Run conversation tests to verify they fail**

Run:

```bash
npm test -- server/test/conversationService.test.ts server/test/conversationRunService.test.ts
```

Expected: FAIL because conversation services do not exist.

- [ ] **Step 3: Implement conversation service minimally**

Create `server/services/conversationService.ts`:

```ts
export function createConversationService(db: Database.Database) {
  return {
    createConversation(input: { title: string; mode: "direct" | "group" }) { /* insert */ },
    listConversations() { /* select */ },
    addParticipant(input: AddParticipantInput) { /* insert participant */ },
    removeParticipant(conversationId: string, personId: string, skillId: string) { /* delete participant */ },
    listParticipants(conversationId: string) { /* select */ },
    createMessage(input: CreateMessageInput) { /* insert message */ },
    listMessages(conversationId: string) { /* select ordered */ }
  };
}
```

- [ ] **Step 4: Implement run and distillation services**

Create `server/services/conversationRunService.ts`:

```ts
export function createConversationRunService({ db, model, conversations }: Deps) {
  return {
    async startDirectRun(input: { conversationId: string; messageId: string; speakerPersonId: string }) { /* insert run, one reply */ },
    async startGroupRun(input: { conversationId: string; messageId: string }) { /* insert run, generate one round */ },
    async stopRun(runId: string, reason: string) { /* update stopped */ },
    getRun(runId: string) { /* select */ }
  };
}
```

Create `server/services/distillationService.ts` with an import-first seam:

```ts
export function createDistillationService({ library, gateway }: Deps) {
  return {
    async queueDistillation(input: { name: string; conversationId?: string }) {
      return { jobId: "stubbed_until_cli_phase" };
    }
  };
}
```

- [ ] **Step 5: Add conversation routes**

Create `server/routes/conversationRoutes.ts`:

```ts
router.post("/conversations", (req, res) => {
  res.status(201).json(conversations.createConversation(req.body));
});

router.post("/conversations/:id/participants", (req, res) => {
  res.status(201).json(conversations.addParticipant({ conversationId: req.params.id, ...req.body }));
});

router.post("/conversations/:id/run/group", async (req, res) => {
  res.status(202).json(await runs.startGroupRun({ conversationId: req.params.id, messageId: req.body.messageId }));
});

router.post("/conversations/:id/run/stop", async (req, res) => {
  await runs.stopRun(req.body.runId, "user_stop");
  res.status(204).send();
});
```

- [ ] **Step 6: Wire routes and run service into app**

Modify `server/app.ts` to instantiate and mount conversation services and routes.

- [ ] **Step 7: Run backend tests to verify they pass**

Run:

```bash
npm test -- server/test/conversationService.test.ts server/test/conversationRunService.test.ts server/test/app.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/services/distillationService.ts server/services/conversationService.ts server/services/conversationRunService.ts server/routes/conversationRoutes.ts server/routes/skillRoutes.ts server/app.ts server/AGENTS.md server/test/conversationService.test.ts server/test/conversationRunService.test.ts
git commit -m "feat: add conversation backend services"
```

---

### Task 4: Replace Evaluation Workspace With Conversation Workspace

**Files:**
- Create: `src/components/ConversationWorkspace.tsx`
- Create: `src/components/ConversationHeader.tsx`
- Create: `src/components/ParticipantTray.tsx`
- Create: `src/components/MessageTimeline.tsx`
- Create: `src/components/Composer.tsx`
- Create: `src/components/PersonaPicker.tsx`
- Create: `src/components/JobPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/api/client.ts`
- Modify: `src/components/WorkflowTabs.tsx`
- Modify: `src/components/EvidencePanel.tsx`
- Modify: `src/components/AGENTS.md`
- Test: `src/test/App.test.tsx`
- Test: `src/test/ConversationWorkspace.test.tsx`

- [ ] **Step 1: Write failing frontend tests for conversation behaviors**

Create `src/test/ConversationWorkspace.test.tsx`:

```tsx
test("adds a persona to the conversation and sends a direct message", async () => {
  render(<ConversationWorkspace api={api} libraryPeople={[{ id: "paul", name: "Paul Graham" }]} />);

  await userEvent.selectOptions(screen.getByLabelText("添加人物"), "paul");
  await userEvent.click(screen.getByRole("button", { name: "加入会话" }));
  await userEvent.type(screen.getByLabelText("输入消息"), "你会投这个项目吗？");
  await userEvent.click(screen.getByRole("button", { name: "单聊" }));

  expect(await screen.findByText(/Paul Graham/i)).toBeInTheDocument();
});

test("starts and stops group chat", async () => {
  render(<ConversationWorkspace api={api} libraryPeople={seedPeople} />);

  await userEvent.click(screen.getByRole("button", { name: "群聊" }));
  expect(screen.getByText(/群聊进行中/i)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "终止群聊" }));
  expect(screen.getByText(/群聊已停止/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run frontend tests to verify they fail**

Run:

```bash
npm test -- src/test/App.test.tsx src/test/ConversationWorkspace.test.tsx
```

Expected: FAIL because the conversation workspace and related API methods do not exist.

- [ ] **Step 3: Expand API client**

Add methods to `src/api/client.ts`:

```ts
listPersonas(): Promise<{ people: Persona[] }>;
importNuwaPersonas(): Promise<{ imported: unknown }>;
createConversation(input: { title: string; mode: "direct" | "group" }): Promise<Conversation>;
addConversationParticipant(input: { conversationId: string; personId: string; skillId: string; joinSource: string }): Promise<unknown>;
sendConversationMessage(input: { conversationId: string; content: string }): Promise<Message>;
startDirectRun(input: { conversationId: string; messageId: string; speakerPersonId: string }): Promise<ConversationRun>;
startGroupRun(input: { conversationId: string; messageId: string }): Promise<ConversationRun>;
stopGroupRun(input: { conversationId: string; runId: string }): Promise<void>;
```

- [ ] **Step 4: Implement composed conversation UI**

Create `src/components/ConversationWorkspace.tsx` with top-level state only:

```tsx
export function ConversationWorkspace({ api, libraryPeople }: Props) {
  const [participants, setParticipants] = useState<ParticipantSummary[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [runState, setRunState] = useState<"idle" | "direct" | "group_running" | "group_stopped">("idle");

  return (
    <section className="workspace-card conversation-workspace">
      <ConversationHeader runState={runState} />
      <ParticipantTray participants={participants} />
      <MessageTimeline messages={messages} />
      <Composer /* send/direct/group/stop callbacks */ />
      <PersonaPicker libraryPeople={libraryPeople} /* add participant */ />
      <JobPanel />
    </section>
  );
}
```

- [ ] **Step 5: Replace old Evaluate path in `App.tsx`**

Update workflow rendering:

```tsx
if (workflow === "Conversation") {
  return <ConversationWorkspace api={options.api} libraryPeople={people} selectedPersonId={options.personId} />;
}
```

Update `WorkflowTabs.tsx` labels so the third tab is `对话`.

- [ ] **Step 6: Update app-level tests**

In `src/test/App.test.tsx`, change:

```tsx
await userEvent.click(screen.getByRole("button", { name: "对话" }));
expect(screen.getByText(/输入消息/i)).toBeInTheDocument();
expect(screen.getByRole("button", { name: "群聊" })).toBeInTheDocument();
```

- [ ] **Step 7: Run frontend tests to verify they pass**

Run:

```bash
npm test -- src/test/App.test.tsx src/test/ConversationWorkspace.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/ConversationWorkspace.tsx src/components/ConversationHeader.tsx src/components/ParticipantTray.tsx src/components/MessageTimeline.tsx src/components/Composer.tsx src/components/PersonaPicker.tsx src/components/JobPanel.tsx src/App.tsx src/api/client.ts src/components/WorkflowTabs.tsx src/components/EvidencePanel.tsx src/components/AGENTS.md src/test/App.test.tsx src/test/ConversationWorkspace.test.tsx
git commit -m "feat: replace evaluation page with conversation workspace"
```

---

### Task 5: Integrate Persona Import Into Frontend Library And Right Panel

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/PeoplePanel.tsx`
- Modify: `src/components/EvidencePanel.tsx`
- Modify: `src/styles.css`
- Test: `src/test/App.test.tsx`
- Test: `e2e/workflow-tabs.spec.ts`

- [ ] **Step 1: Write the failing UI import test**

Add to `src/test/App.test.tsx`:

```tsx
test("loads imported real personas into the left library", async () => {
  render(<App api={apiReturningPaulGraham} />);

  expect(await screen.findByText("Paul Graham")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the UI test to verify it fails**

Run:

```bash
npm test -- src/test/App.test.tsx
```

Expected: FAIL because `App` still uses hardcoded seed personas only.

- [ ] **Step 3: Load personas from backend in `App.tsx`**

Replace static-only behavior with backend-first loading:

```tsx
const [people, setPeople] = useState<SeedPerson[]>([]);

useEffect(() => {
  void api.listPersonas().then((result) => setPeople(result.people));
}, [api]);
```

Fallback to a tiny local placeholder only when API fails.

- [ ] **Step 4: Keep page-height behavior stable while persona count grows**

In `src/styles.css`, ensure:

```css
.person-list,
.evidence-stack,
.message-timeline {
  min-height: 0;
  overflow: auto;
}
```

Do not reintroduce root page scrolling on desktop.

- [ ] **Step 5: Update workflow e2e**

Modify `e2e/workflow-tabs.spec.ts` so it expects:

```ts
await expect(page.getByRole("button", { name: "对话" })).toBeVisible();
await workflowTabs.getByRole("button", { name: "对话", exact: true }).click();
await expect(page.getByText(/输入消息/i)).toBeVisible();
```

- [ ] **Step 6: Run UI and browser tests**

Run:

```bash
npm test -- src/test/App.test.tsx
npm run test:e2e -- e2e/workflow-tabs.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/PeoplePanel.tsx src/components/EvidencePanel.tsx src/styles.css src/test/App.test.tsx e2e/workflow-tabs.spec.ts
git commit -m "feat: load real personas into frontend library"
```

---

### Task 6: Add End-To-End Conversation Flow And Final Verification

**Files:**
- Create: `e2e/conversation-flow.spec.ts`
- Modify: `e2e/AGENTS.md`
- Modify: `docs/daily/2026-06-01.md`
- Modify: `docs/bank/experience.md`

- [ ] **Step 1: Write the browser workflow test**

Create `e2e/conversation-flow.spec.ts`:

```ts
test("imports personas, adds participants, starts group chat, and stops it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "对话" }).click();
  await page.getByLabel("添加人物").selectOption({ label: "Paul Graham" });
  await page.getByRole("button", { name: "加入会话" }).click();
  await page.getByLabel("输入消息").fill("你会如何判断这个创业方向？");
  await page.getByRole("button", { name: "群聊" }).click();
  await expect(page.getByText(/群聊进行中/i)).toBeVisible();
  await page.getByRole("button", { name: "终止群聊" }).click();
  await expect(page.getByText(/群聊已停止/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the e2e test to verify it fails**

Run:

```bash
npm run test:e2e -- e2e/conversation-flow.spec.ts
```

Expected: FAIL until the conversation UI and backend flow are complete.

- [ ] **Step 3: Fix only the missing edges revealed by the browser**

Limit implementation to the failing surfaces from the trace:

```text
- missing accessible label
- wrong button text
- missing run-state text
- broken participant add flow
```

Do not widen scope beyond import/add/send/group/stop.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

Expected: all commands pass.

- [ ] **Step 5: Update GEB docs and memory**

Append to `docs/daily/2026-06-01.md`:

```md
- [进展] 接入 `nuwa-skill` 真实人物导入与对话工作台，第三页由评审表单替换为单聊/群聊工作区。
- [经验] 会话参与者必须绑定 skill 快照而不是人物最新状态，否则导入新版本 skill 会污染历史消息。
- [验证] `npm run test:e2e` 通过真实浏览器的添加人物、发送消息、拉起群聊、终止群聊录证。
```

Append to `docs/bank/experience.md`:

```md
- 会话系统要把人物库、会话参与者、运行态分表；只要把这三层揉在一起，删除人物或更新 skill 就会污染历史聊天。
- 外部蒸馏引擎只能通过网关写入本地快照，聊天页不能直接依赖外部进程的运行态。
```

- [ ] **Step 6: Commit**

```bash
git add e2e/conversation-flow.spec.ts e2e/AGENTS.md docs/daily/2026-06-01.md docs/bank/experience.md
git commit -m "test: verify persona conversation workflow"
```

---

## Self-Review

Spec coverage check:

- real persona import from `nuwa-skill`: Task 2 and Task 5
- `nuwa-skill` gateway and future distillation seam: Task 2 and Task 3
- expanded persona and conversation schema: Task 1
- conversation workspace replacing evaluation page: Task 4
- direct chat, group chat, and stop group chat: Task 3, Task 4, Task 6
- browser evidence and failure-path hardening: Task 5 and Task 6

Placeholder scan:

- no `TBD`, `TODO`, or "similar to task N" placeholders remain
- every task includes exact paths, tests, commands, and expected results

Type consistency check:

- workflow third mode is consistently named `Conversation` in code and `对话` in UI
- backend run status uses `running | stopped | completed | failed`
- participant join source uses `library | manual | distill_job`

