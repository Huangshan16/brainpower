/**
 * [INPUT]: 依赖 config、SQLite 连接、迁移器与 Express app 工厂启动本地后端
 * [OUTPUT]: 启动 HTTP server，无导出业务 API
 * [POS]: server 的进程入口，被 npm run dev:server 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { openDatabase } from "./db/connection.js";
import { migrate } from "./db/migrate.js";

mkdirSync(dirname(config.databasePath), { recursive: true });

const db = openDatabase(config.databasePath);
migrate(db);

const app = createApp({ db });

app.listen(config.port, () => {
  console.log(`brainpower server listening on http://127.0.0.1:${config.port}`);
});
