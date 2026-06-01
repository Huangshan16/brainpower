/**
 * [INPUT]: 依赖 vitest、fetch、Express app 工厂与临时 SQLite 数据库
 * [OUTPUT]: 对外提供 HTTP health、people 路由、persona import 与 POST 输入验证回归测试
 * [POS]: server/test 的应用路由测试，约束 Express 装配边界
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

        expect(imported.status).toBe(202);
        expect(importedBody.imported).toHaveLength(2);
        expect(list.people.map((person: { name: string }) => person.name)).toEqual(expect.arrayContaining(["Paul Graham", "张一鸣"]));
      } finally {
        await closeServer(server);
      }
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
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
});
