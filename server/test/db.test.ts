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

  test("enforces persona and participant constraints on a fresh schema", () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-db-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      migrate(db);

      db.prepare(
        "insert into people (id, name, role, region, tags, status, notes, origin_type, origin_ref, persona_kind, is_archived, is_deleted, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        "person-1",
        "Ada",
        "investor",
        "US",
        "[]",
        "needs_research",
        null,
        "seed",
        null,
        "person",
        0,
        0,
        "2026-06-01T00:00:00.000Z",
        "2026-06-01T00:00:00.000Z"
      );
      db.prepare(
        "insert into skills (id, person_id, version, mental_models_json, heuristics_json, voice_dna_json, anti_patterns_json, honesty_boundaries_json, citations_json, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        "skill-1",
        "person-1",
        1,
        "[]",
        "[]",
        "[]",
        "[]",
        "[]",
        "[]",
        "2026-06-01T00:00:00.000Z"
      );
      db.prepare(
        "insert into conversations (id, title, mode, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?)"
      ).run(
        "conv-1",
        "Test Conversation",
        "group",
        "active",
        "2026-06-01T00:00:00.000Z",
        "2026-06-01T00:00:00.000Z"
      );
      db.prepare(
        "insert into conversation_participants (conversation_id, person_id, skill_id, join_source, position, is_active) values (?, ?, ?, ?, ?, ?)"
      ).run("conv-1", "person-1", "skill-1", "manual", 0, 1);

      const peopleColumns = db.prepare("pragma table_info(people)").all() as Array<{ name: string }>;
      const conversationColumns = db.prepare("pragma table_info(conversations)").all() as Array<{ name: string }>;
      const participantColumns = db.prepare("pragma table_info(conversation_participants)").all() as Array<{ name: string }>;
      const foreignKeys = db.prepare("pragma foreign_key_list(conversation_participants)").all() as Array<{
        from: string;
        table: string;
        to: string;
      }>;

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

      expect(foreignKeys).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ from: "conversation_id", table: "conversations", to: "id" }),
          expect.objectContaining({ from: "person_id", table: "people", to: "id" }),
          expect.objectContaining({ from: "skill_id", table: "skills", to: "id" })
        ])
      );

      expect(() =>
        db
          .prepare(
            "insert into conversation_participants (conversation_id, person_id, skill_id, join_source, position, is_active) values (?, ?, ?, ?, ?, ?)"
          )
          .run("conv-1", "missing-person", "skill-1", "manual", 0, 1)
      ).toThrow();
      expect(() =>
        db
          .prepare(
            "insert into conversation_participants (conversation_id, person_id, skill_id, join_source, position, is_active) values (?, ?, ?, ?, ?, ?)"
          )
          .run("conv-1", "person-1", "skill-1", "manual", -1, 1)
      ).toThrow();
      expect(() =>
        db
          .prepare(
            "insert into people (id, name, role, region, tags, status, origin_type, origin_ref, persona_kind, is_archived, is_deleted, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          )
          .run(
            "person-2",
            "Grace",
            "entrepreneur",
            "US",
            "[]",
            "needs_research",
            "seed",
            null,
            "person",
            2,
            0,
            "2026-06-01T00:00:00.000Z",
            "2026-06-01T00:00:00.000Z"
          )
      ).toThrow();
      expect(() =>
        db
          .prepare(
            "update conversation_participants set is_active = ? where conversation_id = ? and person_id = ? and skill_id = ?"
          )
          .run(2, "conv-1", "person-1", "skill-1")
      ).toThrow();
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("upgrades a legacy people table without rebuilding existing data", () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-db-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      db.exec(`
        create table people (
          id text primary key,
          name text not null,
          role text not null,
          region text not null,
          tags text not null default '[]',
          status text not null,
          notes text,
          created_at text not null,
          updated_at text not null
        );
      `);
      db.prepare(
        "insert into people (id, name, role, region, tags, status, notes, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        "legacy-person",
        "Linus",
        "investor",
        "US",
        "[]",
        "needs_research",
        "legacy row",
        "2026-06-01T00:00:00.000Z",
        "2026-06-01T00:00:00.000Z"
      );

      migrate(db);

      const upgradedPeopleColumns = db.prepare("pragma table_info(people)").all() as Array<{ name: string }>;
      expect(columnNames(upgradedPeopleColumns)).toEqual(
        expect.arrayContaining([
          "origin_type",
          "origin_ref",
          "persona_kind",
          "is_archived",
          "is_deleted"
        ])
      );

      const upgradedRow = db
        .prepare(
          "select id, origin_type, origin_ref, persona_kind, is_archived, is_deleted from people where id = ?"
        )
        .get("legacy-person") as {
        id: string;
        origin_type: string;
        origin_ref: string | null;
        persona_kind: string;
        is_archived: number;
        is_deleted: number;
      };

      expect(upgradedRow).toEqual({
        id: "legacy-person",
        origin_type: "seed",
        origin_ref: null,
        persona_kind: "person",
        is_archived: 0,
        is_deleted: 0
      });

      expect(() =>
        db.prepare("update people set is_archived = ? where id = ?").run(2, "legacy-person")
      ).toThrow();
      expect(() =>
        db.prepare("insert into people (id, name, role, region, tags, status, origin_type, persona_kind, is_archived, is_deleted, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(
            "legacy-invalid",
            "Invalid",
            "investor",
            "US",
            "[]",
            "needs_research",
            "manual",
            "topic",
            1,
            2,
            "2026-06-01T00:00:00.000Z",
            "2026-06-01T00:00:00.000Z"
          )
      ).toThrow();
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("rebuilds legacy conversation_participants and keeps only valid rows", () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-db-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      db.exec(`
        create table people (
          id text primary key,
          name text not null,
          role text not null,
          region text not null,
          tags text not null default '[]',
          status text not null,
          notes text,
          created_at text not null,
          updated_at text not null
        );
        create table skills (
          id text primary key,
          person_id text not null,
          version integer not null,
          mental_models_json text not null default '[]',
          heuristics_json text not null default '[]',
          voice_dna_json text not null default '[]',
          anti_patterns_json text not null default '[]',
          honesty_boundaries_json text not null default '[]',
          citations_json text not null default '[]',
          created_at text not null
        );
        create table conversations (
          id text primary key,
          title text not null,
          mode text not null,
          status text not null,
          created_at text not null,
          updated_at text not null
        );
        create table conversation_participants (
          conversation_id text not null,
          person_id text not null,
          skill_id text not null,
          join_source text not null,
          position integer not null,
          is_active integer not null default 1
        );
      `);

      db.prepare(
        "insert into people (id, name, role, region, tags, status, notes, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run("person-1", "Linus", "investor", "US", "[]", "needs_research", null, "2026-06-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z");
      db.prepare(
        "insert into skills (id, person_id, version, mental_models_json, heuristics_json, voice_dna_json, anti_patterns_json, honesty_boundaries_json, citations_json, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        "skill-1",
        "person-1",
        1,
        "[]",
        "[]",
        "[]",
        "[]",
        "[]",
        "[]",
        "2026-06-01T00:00:00.000Z"
      );
      db.prepare(
        "insert into conversations (id, title, mode, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?)"
      ).run("conv-1", "Legacy Conversation", "group", "active", "2026-06-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z");

      db.prepare(
        "insert into conversation_participants (conversation_id, person_id, skill_id, join_source, position, is_active) values (?, ?, ?, ?, ?, ?)"
      ).run("conv-1", "person-1", "skill-1", "manual", 0, 1);
      db.prepare(
        "insert into conversation_participants (conversation_id, person_id, skill_id, join_source, position, is_active) values (?, ?, ?, ?, ?, ?)"
      ).run("conv-1", "person-1", "skill-1", "manual", 0, 1);
      db.prepare(
        "insert into conversation_participants (conversation_id, person_id, skill_id, join_source, position, is_active) values (?, ?, ?, ?, ?, ?)"
      ).run("missing-conv", "person-1", "skill-1", "manual", -1, 2);

      migrate(db);

      const participantColumns = db.prepare("pragma table_info(conversation_participants)").all() as Array<{ name: string }>;
      const foreignKeys = db.prepare("pragma foreign_key_list(conversation_participants)").all() as Array<{
        from: string;
        table: string;
        to: string;
      }>;
      const rows = db
        .prepare(
          "select conversation_id, person_id, skill_id, join_source, position, is_active from conversation_participants order by conversation_id, person_id, skill_id"
        )
        .all() as Array<{
        conversation_id: string;
        person_id: string;
        skill_id: string;
        join_source: string;
        position: number;
        is_active: number;
      }>;

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
      expect(foreignKeys).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ from: "conversation_id", table: "conversations", to: "id" }),
          expect.objectContaining({ from: "person_id", table: "people", to: "id" }),
          expect.objectContaining({ from: "skill_id", table: "skills", to: "id" })
        ])
      );
      expect(rows).toEqual([
        {
          conversation_id: "conv-1",
          person_id: "person-1",
          skill_id: "skill-1",
          join_source: "manual",
          position: 0,
          is_active: 1
        }
      ]);

      expect(() =>
        db
          .prepare(
            "insert into conversation_participants (conversation_id, person_id, skill_id, join_source, position, is_active) values (?, ?, ?, ?, ?, ?)"
          )
          .run("conv-1", "person-1", "skill-1", "manual", -1, 1)
      ).toThrow();
      expect(() =>
        db
          .prepare(
            "insert into conversation_participants (conversation_id, person_id, skill_id, join_source, position, is_active) values (?, ?, ?, ?, ?, ?)"
          )
          .run("conv-1", "missing-person", "skill-1", "manual", 0, 1)
      ).toThrow();
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
