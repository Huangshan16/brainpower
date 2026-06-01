/**
 * [INPUT]: 依赖 better-sqlite3 与 modelService 执行项目评审与 critique 链持久化
 * [OUTPUT]: 对外提供 createEvaluationService 工厂、evaluateProject 与 critiqueEvaluation 方法
 * [POS]: server/services 的项目评审边界，被 evaluationRoutes 与服务测试消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import { CritiqueSchema, EvaluationSchema, type Critique, type Evaluation } from "../../shared/schemas.js";
import type { createModelService } from "./modelService.js";

type ModelService = ReturnType<typeof createModelService>;

type EvaluationRow = {
  id: string;
  project_title: string;
  project_brief: string;
  skill_id: string;
  person_id: string;
  verdict: "invest" | "pass" | "needs_more_evidence";
  person_judgment: string;
  business_judgment: string;
  risks_json: string;
  questions_json: string;
  score_json: string;
  created_at: string;
};

type CritiqueRow = {
  id: string;
  evaluation_id: string;
  critic_person_id: string;
  target_person_id: string;
  stance: string;
  critique: string;
  created_at: string;
};

function now() {
  return new Date().toISOString();
}

function mapEvaluation(row: EvaluationRow): Evaluation {
  return EvaluationSchema.parse({
    id: row.id,
    projectTitle: row.project_title,
    projectBrief: row.project_brief,
    skillId: row.skill_id,
    personId: row.person_id,
    verdict: row.verdict,
    personJudgment: row.person_judgment,
    businessJudgment: row.business_judgment,
    risks: JSON.parse(row.risks_json) as string[],
    questions: JSON.parse(row.questions_json) as string[],
    score: JSON.parse(row.score_json) as Record<string, number>,
    createdAt: row.created_at
  });
}

function mapCritique(row: CritiqueRow): Critique {
  return CritiqueSchema.parse({
    id: row.id,
    evaluationId: row.evaluation_id,
    criticPersonId: row.critic_person_id,
    targetPersonId: row.target_person_id,
    stance: row.stance,
    critique: row.critique,
    createdAt: row.created_at
  });
}

export function createEvaluationService({ db, model }: { db: Database.Database; model: ModelService }) {
  return {
    async evaluateProject(input: { project: { title: string; brief: string }; personId: string; skillId: string }) {
      const raw = await model.completeJson(
        "Evaluate the startup brief as a sharp digital mentor. Return JSON only.",
        `${input.project.title}\n\n${input.project.brief}`
      );
      const parsed = JSON.parse(raw) as {
        verdict: "invest" | "pass" | "needs_more_evidence";
        personJudgment: string;
        businessJudgment: string;
        risks: string[];
        questions: string[];
        score: Record<string, number>;
      };
      const id = nanoid();
      const createdAt = now();

      db.prepare(
        `insert into evaluations (
          id, project_title, project_brief, skill_id, person_id, verdict,
          person_judgment, business_judgment, risks_json, questions_json, score_json, created_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        input.project.title,
        input.project.brief,
        input.skillId,
        input.personId,
        parsed.verdict,
        parsed.personJudgment,
        parsed.businessJudgment,
        JSON.stringify(parsed.risks),
        JSON.stringify(parsed.questions),
        JSON.stringify(parsed.score),
        createdAt
      );

      return mapEvaluation(db.prepare("select * from evaluations where id = ?").get(id) as EvaluationRow);
    },

    async critiqueEvaluation(input: { evaluationId: string; criticPersonId: string; targetPersonId: string }) {
      const evaluation = db.prepare("select * from evaluations where id = ?").get(input.evaluationId) as EvaluationRow | undefined;

      if (!evaluation) {
        throw new Error("Evaluation not found");
      }

      const raw = await model.completeJson(
        "Critique the evaluation as another digital mentor. Return JSON only.",
        JSON.stringify({
          evaluationId: input.evaluationId,
          projectTitle: evaluation.project_title,
          verdict: evaluation.verdict,
          personJudgment: evaluation.person_judgment,
          businessJudgment: evaluation.business_judgment
        })
      );
      const parsed = JSON.parse(raw) as { critique: string; verdict?: string };
      const id = nanoid();
      const createdAt = now();

      db.prepare(
        `insert into critiques (
          id, evaluation_id, critic_person_id, target_person_id, stance, critique, created_at
        ) values (?, ?, ?, ?, ?, ?, ?)`
      ).run(id, input.evaluationId, input.criticPersonId, input.targetPersonId, parsed.verdict ?? "review", parsed.critique, createdAt);

      return mapCritique(db.prepare("select * from critiques where id = ?").get(id) as CritiqueRow);
    }
  };
}
