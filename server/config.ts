/**
 * [INPUT]: 依赖 dotenv 读取本地环境变量，依赖 process.env 提供运行时配置
 * [OUTPUT]: 对外提供 config 常量，包含端口与 SQLite 数据库路径
 * [POS]: server 的配置边界，被启动入口消费，避免业务层直接读取环境变量
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3001),
  databasePath: process.env.DATABASE_PATH ?? "data/brainpower.sqlite",
  modelBaseUrl: process.env.MODEL_BASE_URL ?? "https://api.openai.com/v1",
  modelApiKey: process.env.MODEL_API_KEY ?? "",
  modelName: process.env.MODEL_NAME ?? "gpt-4.1-mini"
};
