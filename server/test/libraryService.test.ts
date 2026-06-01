/**
 * [INPUT]: 依赖 vitest、server/db 与 libraryService 验证本地资料库服务契约
 * [OUTPUT]: 对外提供人物创建与 snake_case/camelCase 映射回归测试
 * [POS]: server/test 的资料库服务测试，约束服务层与共享 schema 的数据形态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { PersonSchema } from "../../shared/schemas.js";
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
});
