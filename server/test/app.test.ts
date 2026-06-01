/**
 * [INPUT]: 依赖 vitest、fetch、Express app 工厂与临时 SQLite 数据库
 * [OUTPUT]: 对外提供 HTTP health 与 people 路由回归测试
 * [POS]: server/test 的应用路由测试，约束 Express 装配边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createApp } from "../app.js";
import { openDatabase } from "../db/connection.js";
import { migrate } from "../db/migrate.js";

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
        server.close();
      }
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
