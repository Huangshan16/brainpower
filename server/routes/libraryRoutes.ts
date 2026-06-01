/**
 * [INPUT]: 依赖 express Router 与 libraryService 的资料库读写能力
 * [OUTPUT]: 对外提供 createLibraryRoutes 路由工厂
 * [POS]: server/routes 的资料库 HTTP 边界，被 app 装配到 /api
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Router } from "express";
import type { createLibraryService } from "../services/libraryService.js";

type LibraryService = ReturnType<typeof createLibraryService>;

export function createLibraryRoutes(library: LibraryService) {
  const router = Router();

  router.get("/people", (_req, res) => {
    res.json(library.listPeople());
  });

  router.post("/people", (req, res) => {
    res.status(201).json(library.createPerson(req.body));
  });

  router.get("/people/:personId/fragments", (req, res) => {
    res.json(library.listFragments(req.params.personId));
  });

  return router;
}
