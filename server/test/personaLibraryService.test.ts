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

      const deleted = service.listPeople().find((entry) => entry.id === person.id);

      expect(deleted?.isDeleted).toBe(true);
      expect(deleted?.id).toBe(person.id);
      expect(deleted && PersonaSchema.parse(deleted)).toEqual(deleted);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
