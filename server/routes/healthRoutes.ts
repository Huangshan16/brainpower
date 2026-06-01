/**
 * [INPUT]: 依赖 express Router 声明健康检查端点
 * [OUTPUT]: 对外提供 createHealthRoutes 路由工厂
 * [POS]: server/routes 的健康检查路由，被 app 装配到 /api
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Router } from "express";

export function createHealthRoutes() {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  return router;
}
