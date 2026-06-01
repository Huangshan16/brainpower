/**
 * [INPUT]: 依赖 vitest、SQLite 与 personaLibraryService 验证 persona 库去重与软删除契约
 * [OUTPUT]: 对外提供 persona 导入去重、手工创建与软删除回归测试
 * [POS]: server/test 的 persona 库服务测试，约束 PersonaSchema 映射与持久化语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { openDatabase } from "../db/connection.js";
import { migrate } from "../db/migrate.js";
import { createPersonaLibraryService } from "../services/personaLibraryService.js";
import { PersonaSchema } from "../../shared/schemas.js";

describe("personaLibraryService", () => {
  test("imports real personas without duplicating existing entries", () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-persona-library-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      const service = createPersonaLibraryService(db);

      service.upsertImportedPersonas([
        {
          name: "Paul Graham",
          role: "entrepreneur",
          region: "US",
          tags: ["startup"],
          originType: "nuwa_import",
          originRef: "nuwa-skill:paul-graham"
        },
        {
          name: "Paul Graham",
          role: "entrepreneur",
          region: "US",
          tags: ["startup"],
          originType: "nuwa_import",
          originRef: "nuwa-skill:paul-graham"
        }
      ]);

      const paulGraham = service.listPeople().filter((person) => person.name === "Paul Graham");

      expect(paulGraham).toHaveLength(1);
      expect(PersonaSchema.parse(paulGraham[0])).toEqual(paulGraham[0]);
      expect(paulGraham[0].originRef).toBe("nuwa-skill:paul-graham");
      expect(paulGraham[0].originType).toBe("nuwa_import");
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("soft deletes a persona without removing row history", () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-persona-library-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      const service = createPersonaLibraryService(db);
      const person = service.createManualPersona({
        name: "临时人物",
        role: "investor",
        region: "CN",
        tags: []
      });

      service.softDeletePersona(person.id);

      expect(service.listPeople().find((entry) => entry.id === person.id)).toBeUndefined();

      const row = db
        .prepare("select id, is_deleted, origin_type from people where id = ?")
        .get(person.id) as { id: string; is_deleted: number; origin_type: string } | undefined;

      expect(row).toEqual({
        id: person.id,
        is_deleted: 1,
        origin_type: "manual"
      });
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("re-importing a soft-deleted nuwa persona restores it to the visible library", () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-persona-library-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      const service = createPersonaLibraryService(db);
      const [imported] = service.upsertImportedPersonas([
        {
          name: "Paul Graham",
          role: "entrepreneur",
          region: "未知",
          tags: ["nuwa-import"],
          originType: "nuwa_import",
          originRef: "nuwa-skill:paul-graham"
        }
      ]);

      service.softDeletePersona(imported.id);
      expect(service.listPeople().find((entry) => entry.id === imported.id)).toBeUndefined();

      service.upsertImportedPersonas([
        {
          name: "Paul Graham",
          role: "entrepreneur",
          region: "未知",
          tags: ["nuwa-import", "restored"],
          originType: "nuwa_import",
          originRef: "nuwa-skill:paul-graham"
        }
      ]);

      const restored = service.listPeople().find((entry) => entry.originRef === "nuwa-skill:paul-graham");
      expect(restored).toMatchObject({
        id: imported.id,
        isDeleted: false,
        tags: ["nuwa-import", "restored"]
      });
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("re-importing matches a legacy nuwa originRef format", () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-persona-library-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      db.prepare(
        "insert into people (id, name, role, region, tags, status, origin_type, origin_ref, persona_kind, is_archived, is_deleted, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        "legacy-paul",
        "Paul Graham",
        "entrepreneur",
        "未知",
        '["nuwa-import"]',
        "needs_research",
        "nuwa_import",
        "nuwa-skill:Paul Graham",
        "person",
        0,
        0,
        "2026-06-01T00:00:00.000Z",
        "2026-06-01T00:00:00.000Z"
      );

      const service = createPersonaLibraryService(db);
      const [imported] = service.upsertImportedPersonas([
        {
          name: "Paul Graham",
          role: "entrepreneur",
          region: "未知",
          tags: ["nuwa-import", "canonical"],
          originType: "nuwa_import",
          originRef: "nuwa-skill:paul-graham"
        }
      ]);

      const allPaul = service.listPeople().filter((entry) => entry.name === "Paul Graham");

      expect(allPaul).toHaveLength(1);
      expect(imported).toMatchObject({
        id: "legacy-paul",
        originRef: "nuwa-skill:paul-graham",
        tags: ["nuwa-import", "canonical"]
      });
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
