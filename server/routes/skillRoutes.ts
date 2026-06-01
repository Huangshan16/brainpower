/**
 * [INPUT]: 依赖 express Router、zod 输入验证、skillService 的人物技能蒸馏能力与 distillationService 的任务入口
 * [OUTPUT]: 对外提供 createSkillRoutes 路由工厂
 * [POS]: server/routes 的技能蒸馏 HTTP 边界，被 app 装配到 /api
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Router } from "express";
import { z } from "zod";
import type { createSkillService } from "../services/skillService.js";
import type { createDistillationService } from "../services/distillationService.js";

type SkillService = ReturnType<typeof createSkillService>;
type DistillationService = ReturnType<typeof createDistillationService>;

const DistillSkillInputSchema = z.object({
  personId: z.string().min(1)
});

const QueueDistillationInputSchema = z.object({
  name: z.string().min(1),
  conversationId: z.string().min(1).optional()
});

export function createSkillRoutes(skillService: SkillService, distillationService: DistillationService) {
  const router = Router();

  router.post("/skills/distill", async (req, res) => {
    const input = DistillSkillInputSchema.safeParse(req.body);

    if (!input.success) {
      res.status(400).json({ error: "Invalid skill distill payload" });
      return;
    }

    try {
      res.status(201).json(await skillService.distillPersonSkill(input.data.personId));
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Skill distillation failed" });
    }
  });

  router.post("/skills/distill/jobs", async (req, res) => {
    const input = QueueDistillationInputSchema.safeParse(req.body);

    if (!input.success) {
      res.status(400).json({ error: "Invalid distillation job payload" });
      return;
    }

    try {
      res.status(202).json(await distillationService.queueDistillation(input.data));
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Distillation job failed" });
    }
  });

  return router;
}
