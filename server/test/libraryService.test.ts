/**
 * [INPUT]: 依赖 vitest、server/db 与 libraryService 验证本地资料库服务契约
 * [OUTPUT]: 对外提供人物、来源、片段创建与 snake_case/camelCase 映射回归测试
 * [POS]: server/test 的资料库服务测试，约束服务层与共享 schema 的数据形态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { FragmentSchema, PersonSchema, SourceSchema } from "../../shared/schemas.js";
import { openDatabase } from "../db/connection.js";
import { migrate } from "../db/migrate.js";
import { createLibraryService } from "../services/libraryService.js";

describe("libraryService", () => {
  test("creates a person and returns it in matrix order", () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-library-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
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
      expect(PersonSchema.parse(person)).toEqual(person);

      const row = db.prepare("select tags, status, created_at, updated_at from people where id = ?").get(person.id) as {
        tags: string;
        status: string;
        created_at: string;
        updated_at: string;
      };

      expect(JSON.parse(row.tags)).toEqual(person.tags);
      expect(row.status).toBe(person.status);
      expect(row.created_at).toBeTruthy();
      expect(row.updated_at).toBeTruthy();
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("creates source and fragment with shared schema camelCase output", () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-library-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      const library = createLibraryService(db);
      const person = library.createPerson({
        name: "Elon Musk",
        role: "entrepreneur",
        region: "US",
        tags: ["first_principles"]
      });

      const source = library.createSource({
        personId: person.id,
        url: "https://example.com/interview",
        title: "Interview",
        sourceType: "interview",
        trustLevel: "primary",
        crawlStatus: "pending"
      });

      const fragment = library.createFragment({
        sourceId: source.id,
        personId: person.id,
        content: "Reason from physics, not analogy.",
        summary: "First principles reasoning",
        timelineTag: "2012",
        evidenceType: "quote"
      });

      expect(SourceSchema.parse(source)).toEqual(source);
      expect(FragmentSchema.parse(fragment)).toEqual(fragment);
      expect(source.personId).toBe(person.id);
      expect(fragment.sourceId).toBe(source.id);
      expect(fragment.personId).toBe(person.id);
      expect(library.listFragments(person.id)).toEqual([fragment]);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("rejects fragments whose personId does not match the source owner", () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-library-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      const library = createLibraryService(db);
      const sourceOwner = library.createPerson({
        name: "Peter Thiel",
        role: "investor",
        region: "US",
        tags: ["zero_to_one"]
      });
      const otherPerson = library.createPerson({
        name: "Sam Altman",
        role: "ai_builder",
        region: "US",
        tags: ["openai"]
      });
      const source = library.createSource({
        personId: sourceOwner.id,
        url: "https://example.com/source",
        title: "Source",
        sourceType: "essay",
        trustLevel: "primary",
        crawlStatus: "pending"
      });

      expect(() =>
        library.createFragment({
          sourceId: source.id,
          personId: otherPerson.id,
          content: "Bad ownership",
          summary: "Mismatched fragment",
          timelineTag: "2026",
          evidenceType: "note"
        })
      ).toThrow("Fragment personId must match source owner");

      expect(library.listFragments(otherPerson.id)).toEqual([]);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
