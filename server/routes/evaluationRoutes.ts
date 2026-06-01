/**
 * [INPUT]: 依赖 express Router、zod 输入验证与 evaluationService 的项目评审/critique 能力
 * [OUTPUT]: 对外提供 createEvaluationRoutes 路由工厂
 * [POS]: server/routes 的项目评审 HTTP 边界，被 app 装配到 /api
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { createLogger } from "../logger.js";
import type { createEvaluationService } from "../services/evaluationService.js";

type EvaluationService = ReturnType<typeof createEvaluationService>;

const EvaluateInputSchema = z.object({
  project: z.object({
    title: z.string().min(1),
    brief: z.string().min(1)
  }),
  personId: z.string().min(1),
  skillId: z.string().min(1)
});

const CritiqueInputSchema = z.object({
  evaluationId: z.string().min(1),
  criticPersonId: z.string().min(1),
  targetPersonId: z.string().min(1)
});

export function createEvaluationRoutes(evaluationService: EvaluationService) {
  const router = Router();
  const logger = createLogger("evaluationRoutes");

  router.post("/evaluations", async (req, res) => {
    const requestId = nanoid();
    const input = EvaluateInputSchema.safeParse(req.body);

    if (!input.success) {
      logger.warn("evaluation_request_invalid", { requestId, issues: input.error.issues });
      res.status(400).json({ error: "Invalid evaluation payload" });
      return;
    }

    try {
      logger.info("evaluation_request_received", {
        requestId,
        personId: input.data.personId,
        projectTitle: input.data.project.title,
        skillId: input.data.skillId
      });
      const evaluation = await evaluationService.evaluateProject(input.data, { requestId });
      logger.info("evaluation_request_succeeded", {
        requestId,
        evaluationId: evaluation.id,
        verdict: evaluation.verdict
      });
      res.status(201).json(evaluation);
    } catch (error) {
      logger.error("evaluation_request_failed", {
        requestId,
        message: error instanceof Error ? error.message : "Evaluation failed"
      });
      res.status(500).json({ error: error instanceof Error ? error.message : "Evaluation failed" });
    }
  });

  router.post("/critiques", async (req, res) => {
    const input = CritiqueInputSchema.safeParse(req.body);

    if (!input.success) {
      res.status(400).json({ error: "Invalid critique payload" });
      return;
    }

    try {
      res.status(201).json(await evaluationService.critiqueEvaluation(input.data));
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Critique failed" });
    }
  });

  return router;
}
