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
import { createLibraryService } from "../services/libraryService.js";

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
- Paul Graham
- 张一鸣
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
- Paul Graham
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

  test("creates a conversation, runs a group turn, and preserves messages after stop", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-app-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      const library = createLibraryService(db);
      const person = library.createPerson({ name: "Paul Graham", role: "investor", region: "US", tags: ["essays"] });
      db.prepare(
        `insert into skills (
          id, person_id, version, mental_models_json, heuristics_json, voice_dna_json,
          anti_patterns_json, honesty_boundaries_json, citations_json, created_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run("skill-paul-v1", person.id, 1, "[]", "[]", "[]", "[]", "[]", "[]", "2026-06-01T00:00:00.000Z");

      const app = createApp({ db });
      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      try {
        const createdConversation = await fetch(`http://127.0.0.1:${port}/api/conversations`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "创业判断", mode: "group" })
        });
        const conversation = await createdConversation.json();

        const participant = await fetch(`http://127.0.0.1:${port}/api/conversations/${conversation.id}/participants`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ personId: person.id, skillId: "skill-paul-v1", joinSource: "library" })
        });
        const participantBody = await participant.json();

        const userMessageResponse = await fetch(`http://127.0.0.1:${port}/api/conversations/${conversation.id}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ senderType: "user", senderId: "user-local", content: "给出一句判断。" })
        });
        const userMessage = await userMessageResponse.json();

        const runResponse = await fetch(`http://127.0.0.1:${port}/api/conversations/${conversation.id}/run/group`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messageId: userMessage.id })
        });
        const run = await runResponse.json();

        const stopped = await fetch(`http://127.0.0.1:${port}/api/conversations/${conversation.id}/run/stop`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ runId: run.id, reason: "user_stop" })
        });
        const messages = await fetch(`http://127.0.0.1:${port}/api/conversations/${conversation.id}/messages`).then((res) =>
          res.json()
        );
        const removed = await fetch(
          `http://127.0.0.1:${port}/api/conversations/${conversation.id}/participants/${person.id}/skill-paul-v1`,
          { method: "DELETE" }
        );
        const participantsAfterDelete = await fetch(
          `http://127.0.0.1:${port}/api/conversations/${conversation.id}/participants`
        ).then((res) => res.json());

        expect(createdConversation.status).toBe(201);
        expect(participant.status).toBe(201);
        expect(userMessageResponse.status).toBe(201);
        expect(runResponse.status).toBe(202);
        expect(stopped.status).toBe(200);
        expect(removed.status).toBe(204);
        expect(participantBody).toMatchObject({ personId: person.id, skillId: "skill-paul-v1" });
        expect(messages.map((message: { senderType: string }) => message.senderType)).toEqual(["user", "system", "persona"]);
        expect(participantsAfterDelete).toEqual([]);
      } finally {
        await closeServer(server);
      }
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
