/**
 * [INPUT]: 依赖 express、cors、better-sqlite3 与路由工厂装配 HTTP 应用
 * [OUTPUT]: 对外提供 createApp 工厂
 * [POS]: server 的 Express 应用边界，被 index 启动入口与 app 测试消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type Database from "better-sqlite3";
import cors from "cors";
import express from "express";
import { createHealthRoutes } from "./routes/healthRoutes.js";
import { createLibraryRoutes } from "./routes/libraryRoutes.js";
import { createLibraryService } from "./services/libraryService.js";

type AppOptions = {
  db: Database.Database;
};

export function createApp({ db }: AppOptions) {
  const app = express();
  const library = createLibraryService(db);

  app.use(cors());
  app.use(express.json());
  app.use("/api", createHealthRoutes());
  app.use("/api", createLibraryRoutes(library));

  return app;
}
