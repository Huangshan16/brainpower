/**
 * [INPUT]: 依赖 express Router、zod 输入验证与 researchService 的种子 URL 采集能力
 * [OUTPUT]: 对外提供 createResearchRoutes 路由工厂
 * [POS]: server/routes 的研究采集 HTTP 边界，被 app 装配到 /api
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Router } from "express";
import { z } from "zod";
import type { createResearchService } from "../services/researchService.js";

type ResearchService = ReturnType<typeof createResearchService>;

const CrawlInputSchema = z.object({
  personId: z.string().min(1),
  url: z.string().url()
});

export function createResearchRoutes(research: ResearchService) {
  const router = Router();

  router.post("/research/crawl", async (req, res) => {
    const input = CrawlInputSchema.safeParse(req.body);

    if (!input.success) {
      res.status(400).json({ error: "Invalid crawl payload" });
      return;
    }

    try {
      res.status(201).json(await research.crawlSeedUrl(input.data));
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Crawl failed" });
    }
  });

  return router;
}
