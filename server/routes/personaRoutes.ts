/**
 * [INPUT]: 依赖 express Router、personaLibraryService、nuwaGatewayService 与薄输入处理
 * [OUTPUT]: 对外提供 createPersonaRoutes 路由工厂
 * [POS]: server/routes 的 persona HTTP 边界，被 app 装配到 /api
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Router } from "express";
import type { createNuwaGatewayService } from "../services/nuwaGatewayService.js";
import type { createPersonaLibraryService } from "../services/personaLibraryService.js";

type PersonaLibraryService = ReturnType<typeof createPersonaLibraryService>;
type NuwaGatewayService = ReturnType<typeof createNuwaGatewayService>;

export function createPersonaRoutes(personaLibrary: PersonaLibraryService, nuwaGateway: NuwaGatewayService) {
  const router = Router();

  router.get("/personas", (_req, res) => {
    res.json({ people: personaLibrary.listPeople() });
  });

  router.post("/personas/import/nuwa", async (_req, res) => {
    const imported = await nuwaGateway.listImportedPersonas();

    res.status(202).json({ imported: personaLibrary.upsertImportedPersonas(imported) });
  });

  router.delete("/personas/:personId", (req, res) => {
    try {
      personaLibrary.softDeletePersona(req.params.personId);
      res.status(204).send();
    } catch {
      res.status(404).json({ error: "Persona not found" });
    }
  });

  return router;
}
