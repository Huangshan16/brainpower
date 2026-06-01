/**
 * [INPUT]: 依赖 express Router、zod 输入验证与 evaluationService 的项目评审/critique 能力
 * [OUTPUT]: 对外提供 createEvaluationRoutes 路由工厂
 * [POS]: server/routes 的项目评审 HTTP 边界，被 app 装配到 /api
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Router } from "express";
import { z } from "zod";
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

  router.post("/evaluations", async (req, res) => {
    const input = EvaluateInputSchema.safeParse(req.body);

    if (!input.success) {
      res.status(400).json({ error: "Invalid evaluation payload" });
      return;
    }

    try {
      res.status(201).json(await evaluationService.evaluateProject(input.data));
    } catch (error) {
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
