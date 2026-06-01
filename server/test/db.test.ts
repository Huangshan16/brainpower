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

function columnNames(rows: Array<{ name: string }>) {
  return rows.map((row) => row.name);
}

describe("database schema", () => {
  test("creates the core Digital Mentor Matrix tables", () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-db-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      migrate(db);

      const rows = db
        .prepare("select name from sqlite_master where type = 'table' order by name")
        .all() as Array<{ name: string }>;

      expect(columnNames(rows)).toEqual([
        "conversation_participants",
        "conversations",
        "critiques",
        "evaluations",
        "fragments",
        "jobs",
        "people",
        "skills",
        "sources"
      ]);

      const sourceColumns = db.prepare("pragma table_info(sources)").all() as Array<{ name: string }>;
      expect(columnNames(sourceColumns)).toEqual([
        "id",
        "person_id",
        "url",
        "title",
        "source_type",
        "trust_level",
        "crawl_status",
        "fetched_at",
        "created_at"
      ]);

      const fragmentColumns = db.prepare("pragma table_info(fragments)").all() as Array<{ name: string }>;
      expect(columnNames(fragmentColumns)).toEqual([
        "id",
        "source_id",
        "person_id",
        "content",
        "summary",
        "timeline_tag",
        "evidence_type",
        "created_at"
      ]);

      db.prepare(
        "insert into jobs (id, type, status, input, output, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)"
      ).run("job-1", "crawl", "queued", "[]", "[]", "2026-06-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z");
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("creates persona metadata fields and conversation tables", () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-db-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      migrate(db);

      const peopleColumns = db.prepare("pragma table_info(people)").all() as Array<{ name: string }>;
      const conversationColumns = db.prepare("pragma table_info(conversations)").all() as Array<{ name: string }>;
      const participantColumns = db.prepare("pragma table_info(conversation_participants)").all() as Array<{ name: string }>;

      expect(columnNames(peopleColumns)).toEqual(
        expect.arrayContaining([
          "origin_type",
          "origin_ref",
          "persona_kind",
          "is_archived",
          "is_deleted"
        ])
      );
      expect(columnNames(conversationColumns)).toEqual(
        expect.arrayContaining(["id", "title", "mode", "status", "created_at", "updated_at"])
      );
      expect(columnNames(participantColumns)).toEqual(
        expect.arrayContaining([
          "conversation_id",
          "person_id",
          "skill_id",
          "join_source",
          "position",
          "is_active"
        ])
      );
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
