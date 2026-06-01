/**
 * [INPUT]: 依赖 vitest、SQLite 与 evaluationService 验证项目评审和 critique 记录落库
 * [OUTPUT]: 对外提供 evaluationService 的评审与反驳链测试
 * [POS]: server/test 的评审服务测试，约束项目评审闭环
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { openDatabase } from "../db/connection.js";
import { migrate } from "../db/migrate.js";
import { createEvaluationService } from "../services/evaluationService.js";

describe("evaluationService", () => {
  test("stores one evaluation per selected persona and a critique record", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-eval-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      const model = {
        completeJson: async () =>
          JSON.stringify({
            verdict: "pass",
            personJudgment: "founder insight is thin",
            businessJudgment: "market exists but wedge is weak",
            risks: ["distribution"],
            questions: ["why now"],
            score: { conviction: 42 },
            critique: "Not sharp enough."
          })
      };
      const service = createEvaluationService({ db, model });

      const evaluation = await service.evaluateProject({
        project: { title: "AI founder OS", brief: "A cognition tool for founders." },
        personId: "person_a",
        skillId: "skill_a"
      });
      const critique = await service.critiqueEvaluation({
        evaluationId: evaluation.id,
        criticPersonId: "person_b",
        targetPersonId: "person_a"
      });

      expect(evaluation.verdict).toBe("pass");
      expect(critique.evaluationId).toBe(evaluation.id);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("logs context and fails early when the model omits required evaluation fields", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-eval-"));
    const db = openDatabase(join(dir, "test.sqlite"));
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    try {
      migrate(db);
      const model = {
        completeJson: async () =>
          JSON.stringify({
            verdict: "pass",
            businessJudgment: "market exists but wedge is weak",
            risks: ["distribution"],
            questions: ["why now"],
            score: { conviction: 42 }
          })
      };
      const service = createEvaluationService({ db, logger, model });

      await expect(
        service.evaluateProject(
          {
            project: { title: "AI founder OS", brief: "A cognition tool for founders." },
            personId: "person_a",
            skillId: "skill_a"
          },
          { requestId: "req_eval_missing_field" }
        )
      ).rejects.toThrow(/missing required fields: personJudgment/i);

      expect(logger.error).toHaveBeenCalledWith(
        "evaluation_payload_invalid",
        expect.objectContaining({
          requestId: "req_eval_missing_field",
          missingFields: ["personJudgment"]
        })
      );
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("asks the model for the exact evaluation payload contract", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-eval-"));
    const db = openDatabase(join(dir, "test.sqlite"));
    const prompts: string[] = [];

    try {
      migrate(db);
      const model = {
        completeJson: async (systemPrompt: string) => {
          prompts.push(systemPrompt);

          return JSON.stringify({
            verdict: "needs_more_evidence",
            personJudgment: "Founder signal is not yet proven.",
            businessJudgment: "Market thesis needs sharper wedge evidence.",
            risks: ["weak distribution"],
            questions: ["what is the unique insight"],
            score: { conviction: 50 }
          });
        }
      };
      const service = createEvaluationService({ db, model });

      await service.evaluateProject({
        project: { title: "AI founder OS", brief: "A cognition tool for founders." },
        personId: "person_a",
        skillId: "skill_a"
      });

      expect(prompts[0]).toContain("personJudgment");
      expect(prompts[0]).toContain("businessJudgment");
      expect(prompts[0]).toContain("risks");
      expect(prompts[0]).toContain("questions");
      expect(prompts[0]).toContain("score");
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
