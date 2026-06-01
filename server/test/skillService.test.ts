/**
 * [INPUT]: 依赖 vitest、SQLite、libraryService 与 skillService 验证引用感知的人物技能蒸馏
 * [OUTPUT]: 对外提供 skillService 的持久化与引用约束测试
 * [POS]: server/test 的技能服务测试，约束资料片段到人物 skill 的蒸馏闭环
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { openDatabase } from "../db/connection.js";
import { migrate } from "../db/migrate.js";
import { createLibraryService } from "../services/libraryService.js";
import { createSkillService } from "../services/skillService.js";

describe("skillService", () => {
  test("stores a citation-aware skill for a person", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-skill-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      const library = createLibraryService(db);
      const person = library.createPerson({ name: "Peter Thiel", role: "investor", region: "US", tags: ["contrarian"] });
      const source = library.createSource({
        personId: person.id,
        url: "https://example.com",
        title: "Interview",
        sourceType: "interview",
        trustLevel: "medium",
        crawlStatus: "succeeded"
      });
      const fragment = library.createFragment({
        sourceId: source.id,
        personId: person.id,
        content: "Competition is for losers.",
        summary: "Contrarian monopoly thesis",
        timelineTag: "career",
        evidenceType: "thesis"
      });
      const model = {
        completeJson: async () =>
          JSON.stringify({
            mentalModels: ["seek monopoly"],
            heuristics: ["avoid crowded markets"],
            voiceDna: ["contrarian"],
            antiPatterns: ["commodity competition"],
            honestyBoundaries: ["public quote only"],
            citations: [fragment.id]
          })
      };
      const service = createSkillService({ db, library, model });

      const skill = await service.distillPersonSkill(person.id);

      expect(skill.personId).toBe(person.id);
      expect(skill.citations).toEqual([fragment.id]);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
