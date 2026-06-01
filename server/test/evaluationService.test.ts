/**
 * [INPUT]: 依赖 vitest、SQLite 与 evaluationService 验证项目评审和 critique 记录落库
 * [OUTPUT]: 对外提供 evaluationService 的评审与反驳链测试
 * [POS]: server/test 的评审服务测试，约束项目评审闭环
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
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
});
