/**
 * [INPUT]: 依赖 vitest 的断言能力，依赖 server/db 的连接与迁移入口
 * [OUTPUT]: 对外提供 database schema 回归测试
 * [POS]: server/test 的数据库契约测试，约束 SQLite 核心表集合
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { openDatabase } from "../db/connection.js";
import { migrate } from "../db/migrate.js";

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
