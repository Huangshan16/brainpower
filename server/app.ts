/**
 * [INPUT]: 依赖 express、cors、better-sqlite3 与路由工厂装配 HTTP 应用
 * [OUTPUT]: 对外提供 createApp 工厂
 * [POS]: server 的 Express 应用边界，被 index 启动入口与 app 测试消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type Database from "better-sqlite3";
import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { createHealthRoutes } from "./routes/healthRoutes.js";
import { createEvaluationRoutes } from "./routes/evaluationRoutes.js";
import { createLibraryRoutes } from "./routes/libraryRoutes.js";
import { createResearchRoutes } from "./routes/researchRoutes.js";
import { createSkillRoutes } from "./routes/skillRoutes.js";
import { createEvaluationService } from "./services/evaluationService.js";
import { createLibraryService } from "./services/libraryService.js";
import { createModelService } from "./services/modelService.js";
import { createResearchService } from "./services/researchService.js";
import { createSkillService } from "./services/skillService.js";

type AppOptions = {
  db: Database.Database;
};

export function createApp({ db }: AppOptions) {
  const app = express();
  const library = createLibraryService(db);
  const model = createModelService({
    baseUrl: config.modelBaseUrl,
    apiKey: config.modelApiKey,
    modelName: config.modelName
  });
  const research = createResearchService({
    db,
    library,
    fetchPage: async (url) => {
      const response = await fetch(url);

      return {
        url: response.url,
        html: await response.text()
      };
    }
  });
  const skillService = createSkillService({ db, library, model });
  const evaluationService = createEvaluationService({ db, model });

  app.use(cors());
  app.use(express.json());
  app.use("/api", createHealthRoutes());
  app.use("/api", createLibraryRoutes(library));
  app.use("/api", createResearchRoutes(research));
  app.use("/api", createSkillRoutes(skillService));
  app.use("/api", createEvaluationRoutes(evaluationService));

  return app;
}
