/**
 * [INPUT]: 依赖 vitest、fetch、Express app 工厂与临时 SQLite 数据库
 * [OUTPUT]: 对外提供 HTTP health、people、persona import、conversation run 与 POST 输入验证回归测试
 * [POS]: server/test 的应用路由测试，约束 Express 装配与 conversation route 边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createApp } from "../app.js";
import { openDatabase } from "../db/connection.js";
import { migrate } from "../db/migrate.js";
import type { createModelService } from "../services/modelService.js";

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

describe("app routes", () => {
  test("returns health and people list", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-app-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      const app = createApp({ db });
      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      try {
        const health = await fetch(`http://127.0.0.1:${port}/api/health`).then((res) => res.json());
        const people = await fetch(`http://127.0.0.1:${port}/api/people`).then((res) => res.json());

        expect(health).toEqual({ ok: true });
        expect(people).toEqual([]);
      } finally {
        await closeServer(server);
      }
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("imports nuwa personas and lists them through persona routes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-app-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      const app = createApp({
        db,
        nuwaGateway: {
          fetchReadme: async () => `
## 已蒸馏人物

### 人物Skill

| 人物 | 领域 | 独立仓库 | 一键安装 |
|------|------|---------|---------|
| 🔥 **Paul Graham** | 创业/写作/产品/人生哲学 | [paul-graham-skill](https://github.com/alchaincyf/paul-graham-skill) | \`npx skills add alchaincyf/paul-graham-skill\` |
| 🔥 **张一鸣** | 产品/组织/全球化/人才 | [zhang-yiming-skill](https://github.com/alchaincyf/zhang-yiming-skill) | \`npx skills add alchaincyf/zhang-yiming-skill\` |
`
        }
      });
      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      try {
        const imported = await fetch(`http://127.0.0.1:${port}/api/personas/import/nuwa`, { method: "POST" });
        const importedBody = await imported.json();
        const list = await fetch(`http://127.0.0.1:${port}/api/personas`).then((res) => res.json());
        const [firstImported] = importedBody.imported as Array<{ id: string }>;
        const deleted = await fetch(`http://127.0.0.1:${port}/api/personas/${firstImported.id}`, { method: "DELETE" });
        const personaListAfterDelete = await fetch(`http://127.0.0.1:${port}/api/personas`).then((res) => res.json());
        const peopleListAfterDelete = await fetch(`http://127.0.0.1:${port}/api/people`).then((res) => res.json());

        expect(imported.status).toBe(202);
        expect(importedBody.imported).toHaveLength(2);
        expect(list.people.map((person: { name: string }) => person.name)).toEqual(expect.arrayContaining(["Paul Graham", "张一鸣"]));
        expect(deleted.status).toBe(204);
        expect(personaListAfterDelete.people.map((person: { id: string }) => person.id)).not.toContain(firstImported.id);
        expect(peopleListAfterDelete.map((person: { id: string }) => person.id)).not.toContain(firstImported.id);
      } finally {
        await closeServer(server);
      }
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("returns a stable gateway error when nuwa import fails", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-app-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      const app = createApp({
        db,
        nuwaGateway: {
          fetchReadme: async () => {
            throw new Error("README unavailable");
          }
        }
      });
      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/personas/import/nuwa`, { method: "POST" });
        const body = await response.json();

        expect(response.status).toBe(502);
        expect(body).toEqual({ error: "Failed to import nuwa personas" });
      } finally {
        await closeServer(server);
      }
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("queues an import-first distillation job and normalizes a matched persona", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-app-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      const app = createApp({
        db,
        nuwaGateway: {
          fetchReadme: async () => `
## 已蒸馏人物

### 人物Skill

| 人物 | 领域 | 独立仓库 | 一键安装 |
|------|------|---------|---------|
| 🔥 **Paul Graham** | 创业/写作/产品/人生哲学 | [paul-graham-skill](https://github.com/alchaincyf/paul-graham-skill) | \`npx skills add alchaincyf/paul-graham-skill\` |
`
        }
      });
      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/skills/distill/jobs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Paul Graham" })
        });
        const body = await response.json();
        const people = await fetch(`http://127.0.0.1:${port}/api/personas`).then((res) => res.json());

        expect(response.status).toBe(202);
        expect(body.status).toBe("succeeded");
        expect(body.personId).toEqual(expect.any(String));
        expect(people.people).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: "Paul Graham", originType: "nuwa_import" })])
        );
      } finally {
        await closeServer(server);
      }
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("marks distillation jobs as failed when gateway import throws", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-app-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      const app = createApp({
        db,
        nuwaGateway: {
          fetchReadme: async () => {
            throw new Error("gateway broke");
          }
        }
      });
      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/skills/distill/jobs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Paul Graham" })
        });
        const body = await response.json();
        const job = db
          .prepare("select status, error from jobs order by created_at desc, id desc limit 1")
          .get() as { status: string; error: string | null };

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: "gateway broke" });
        expect(job).toEqual({ status: "failed", error: "gateway broke" });
      } finally {
        await closeServer(server);
      }
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("returns a stable persistence error when imported personas cannot be saved", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-app-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      const app = createApp({
        db,
        nuwaGateway: {
          fetchReadme: async () => `
## 已蒸馏人物

### 人物Skill

| 人物 | 领域 | 独立仓库 | 一键安装 |
|------|------|---------|---------|
| 🔥 **Paul Graham** | 创业/写作/产品/人生哲学 | [paul-graham-skill](https://github.com/alchaincyf/paul-graham-skill) | \`npx skills add alchaincyf/paul-graham-skill\` |
`
        }
      });
      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      db.close();

      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/personas/import/nuwa`, { method: "POST" });
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: "Failed to persist imported personas" });
      } finally {
        await closeServer(server);
        rmSync(dir, { recursive: true, force: true });
      }
    } catch (error) {
      rmSync(dir, { recursive: true, force: true });
      throw error;
    }
  });

  test("creates people and returns stable validation errors", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-app-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      const app = createApp({ db });
      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      try {
        const invalid = await fetch(`http://127.0.0.1:${port}/api/people`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Broken" })
        });
        const invalidBody = await invalid.json();

        expect(invalid.status).toBe(400);
        expect(invalidBody).toEqual({ error: "Invalid person payload" });

        const created = await fetch(`http://127.0.0.1:${port}/api/people`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Peter Thiel",
            role: "investor",
            region: "US",
            tags: ["zero_to_one"],
            notes: "Contrarian investor"
          })
        });
        const createdBody = await created.json();

        expect(created.status).toBe(201);
        expect(createdBody).toMatchObject({
          name: "Peter Thiel",
          role: "investor",
          region: "US",
          tags: ["zero_to_one"],
          notes: "Contrarian investor",
          status: "needs_research"
        });
      } finally {
        await closeServer(server);
      }
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("creates a conversation, runs group chat, and stops the run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-app-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      db.prepare(
        `insert into people (
          id, name, role, region, tags, status, origin_type, origin_ref, persona_kind, is_archived, is_deleted, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        "person-paul",
        "Paul Graham",
        "investor",
        "US",
        '["essays"]',
        "ready_to_distill",
        "seed",
        null,
        "person",
        0,
        0,
        "2026-06-01T00:00:00.000Z",
        "2026-06-01T00:00:00.000Z"
      );
      db.prepare(
        `insert into skills (
          id, person_id, version, mental_models_json, heuristics_json, voice_dna_json,
          anti_patterns_json, honesty_boundaries_json, citations_json, created_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run("skill-paul-v1", "person-paul", 1, "[]", "[]", "[]", "[]", "[]", "[]", "2026-06-01T00:00:00.000Z");

      const app = createApp({
        db,
        model: {
          completeJson: async () => JSON.stringify({ reply: "先验证需求强度。" })
        } as Pick<ReturnType<typeof createModelService>, "completeJson">
      });
      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      try {
        const conversation = await fetch(`http://127.0.0.1:${port}/api/conversations`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "创业讨论", mode: "group" })
        }).then((res) => res.json());
        const participant = await fetch(`http://127.0.0.1:${port}/api/conversations/${conversation.id}/participants`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ personId: "person-paul", joinSource: "library" })
        });
        const message = await fetch(`http://127.0.0.1:${port}/api/conversations/${conversation.id}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: "会投吗？" })
        }).then((res) => res.json());
        const run = await fetch(`http://127.0.0.1:${port}/api/conversations/${conversation.id}/run/group`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messageId: message.id })
        }).then((res) => res.json());
        const stopped = await fetch(`http://127.0.0.1:${port}/api/conversations/${conversation.id}/run/stop`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ runId: run.id })
        });
        const wrongStop = await fetch(`http://127.0.0.1:${port}/api/conversations/fake-conversation/run/stop`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ runId: run.id })
        });
        const messages = await fetch(`http://127.0.0.1:${port}/api/conversations/${conversation.id}/messages`).then((res) =>
          res.json()
        );

        expect(participant.status).toBe(201);
        expect(run.status).toBe("running");
        expect(stopped.status).toBe(204);
        expect(wrongStop.status).toBe(404);
        expect(messages.messages).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ senderType: "user", content: "会投吗？" }),
            expect.objectContaining({ senderType: "persona", senderId: "person-paul" }),
            expect.objectContaining({ senderType: "system" })
          ])
        );
      } finally {
        await closeServer(server);
      }
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
