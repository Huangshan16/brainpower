/**
 * [INPUT]: 依赖 better-sqlite3、libraryService 与 modelService 执行人物资料到 skill 的蒸馏与引用校验
 * [OUTPUT]: 对外提供 createSkillService 工厂与 distillPersonSkill 方法
 * [POS]: server/services 的技能蒸馏边界，被 skillRoutes 与服务测试消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import { SkillSchema, type Skill } from "../../shared/schemas.js";
import type { createLibraryService } from "./libraryService.js";
import type { createModelService } from "./modelService.js";

type LibraryService = ReturnType<typeof createLibraryService>;
type ModelService = ReturnType<typeof createModelService>;

type SkillRow = {
  id: string;
  person_id: string;
  version: number;
  mental_models_json: string;
  heuristics_json: string;
  voice_dna_json: string;
  anti_patterns_json: string;
  honesty_boundaries_json: string;
  citations_json: string;
  created_at: string;
};

function now() {
  return new Date().toISOString();
}

function parseStringArray(value: string) {
  return JSON.parse(value) as string[];
}

function mapSkill(row: SkillRow): Skill {
  return SkillSchema.parse({
    id: row.id,
    personId: row.person_id,
    version: row.version,
    mentalModels: parseStringArray(row.mental_models_json),
    heuristics: parseStringArray(row.heuristics_json),
    voiceDna: parseStringArray(row.voice_dna_json),
    antiPatterns: parseStringArray(row.anti_patterns_json),
    honestyBoundaries: parseStringArray(row.honesty_boundaries_json),
    citations: parseStringArray(row.citations_json),
    createdAt: row.created_at
  });
}

export function createSkillService({
  db,
  library,
  model
}: {
  db: Database.Database;
  library: LibraryService;
  model: ModelService;
}) {
  return {
    async distillPersonSkill(personId: string) {
      const fragments = library.listFragments(personId);
      const citations = new Set(fragments.map((fragment) => fragment.id));
      const prompt = fragments.map((fragment) => `${fragment.id}: ${fragment.content}`).join("\n\n");
      const raw = await model.completeJson(
        "Distill a person's decision-making skill from cited evidence. Return JSON only.",
        prompt || `No fragments found for ${personId}`
      );
      const parsed = JSON.parse(raw) as {
        mentalModels: string[];
        heuristics: string[];
        voiceDna: string[];
        antiPatterns: string[];
        honestyBoundaries: string[];
        citations: string[];
      };

      if (!parsed.citations.every((citation) => citations.has(citation))) {
        throw new Error("Skill citations must belong to the selected person");
      }

      const id = nanoid();
      const createdAt = now();

      db.prepare(
        `insert into skills (
          id, person_id, version, mental_models_json, heuristics_json, voice_dna_json,
          anti_patterns_json, honesty_boundaries_json, citations_json, created_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        personId,
        1,
        JSON.stringify(parsed.mentalModels),
        JSON.stringify(parsed.heuristics),
        JSON.stringify(parsed.voiceDna),
        JSON.stringify(parsed.antiPatterns),
        JSON.stringify(parsed.honestyBoundaries),
        JSON.stringify(parsed.citations),
        createdAt
      );

      return mapSkill(db.prepare("select * from skills where id = ?").get(id) as SkillRow);
    }
  };
}
