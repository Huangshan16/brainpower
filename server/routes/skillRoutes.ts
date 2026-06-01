/**
 * [INPUT]: 依赖 express Router、zod 输入验证与 skillService 的人物技能蒸馏能力
 * [OUTPUT]: 对外提供 createSkillRoutes 路由工厂
 * [POS]: server/routes 的技能蒸馏 HTTP 边界，被 app 装配到 /api
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Router } from "express";
import { z } from "zod";
import type { createSkillService } from "../services/skillService.js";

type SkillService = ReturnType<typeof createSkillService>;

const DistillSkillInputSchema = z.object({
  personId: z.string().min(1)
});

export function createSkillRoutes(skillService: SkillService) {
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

  return router;
}
