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
import { createLogger } from "./logger.js";
import { createConversationRoutes } from "./routes/conversationRoutes.js";
import { createHealthRoutes } from "./routes/healthRoutes.js";
import { createEvaluationRoutes } from "./routes/evaluationRoutes.js";
import { createLibraryRoutes } from "./routes/libraryRoutes.js";
import { createPersonaRoutes } from "./routes/personaRoutes.js";
import { createResearchRoutes } from "./routes/researchRoutes.js";
import { createSkillRoutes } from "./routes/skillRoutes.js";
import { createConversationRunService } from "./services/conversationRunService.js";
import { createConversationService } from "./services/conversationService.js";
import { createDistillationService } from "./services/distillationService.js";
import { createEvaluationService } from "./services/evaluationService.js";
import { createLibraryService } from "./services/libraryService.js";
import { createModelService } from "./services/modelService.js";
import { createNuwaGatewayService } from "./services/nuwaGatewayService.js";
import { createPersonaLibraryService } from "./services/personaLibraryService.js";
import { createResearchService } from "./services/researchService.js";
import { createSkillService } from "./services/skillService.js";

type AppOptions = {
  db: Database.Database;
  nuwaGateway?: {
    fetchReadme?: () => Promise<string>;
  };
  model?: ReturnType<typeof createModelService>;
};

export function createApp({ db, nuwaGateway: nuwaGatewayOptions, model: modelOverride }: AppOptions) {
  const app = express();
  const appLogger = createLogger("app");
  const library = createLibraryService(db);
  const conversations = createConversationService(db);
  const personaLibrary = createPersonaLibraryService(db);
  const model =
    modelOverride ??
    createModelService({
      baseUrl: config.modelBaseUrl,
      apiKey: config.modelApiKey,
      modelName: config.modelName,
      logger: createLogger("modelService"),
      timeoutMs: config.modelTimeoutMs
    });
  const conversationRuns = createConversationRunService({ db, conversations, model });
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
  const nuwaGateway = createNuwaGatewayService(nuwaGatewayOptions);
  const distillation = createDistillationService({ db, library: personaLibrary, gateway: nuwaGateway, conversations });
  const skillService = createSkillService({ db, library, model });
  const evaluationService = createEvaluationService({ db, logger: createLogger("evaluationService"), model });

  app.use(cors());
  app.use(express.json());
  app.use("/api", createHealthRoutes());
  app.use("/api", createLibraryRoutes(library));
  app.use("/api", createConversationRoutes(conversations, conversationRuns));
  app.use("/api", createPersonaRoutes(personaLibrary, nuwaGateway));
  app.use("/api", createResearchRoutes(research));
  app.use("/api", createSkillRoutes(skillService, distillation));
  app.use("/api", createEvaluationRoutes(evaluationService));
  appLogger.info("app_routes_ready", {
    routes: [
      "/api/health",
      "/api/people",
      "/api/conversations",
      "/api/personas",
      "/api/personas/import/nuwa",
      "/api/research/crawl",
      "/api/skills/distill",
      "/api/skills/distill/jobs",
      "/api/evaluations"
    ]
  });

  return app;
}
