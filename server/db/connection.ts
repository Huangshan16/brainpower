/**
 * [INPUT]: 依赖 better-sqlite3 创建同步 SQLite 连接
 * [OUTPUT]: 对外提供 openDatabase 函数
 * [POS]: server/db 的连接边界，被迁移器、服务与测试消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import Database from "better-sqlite3";

export function openDatabase(path: string) {
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  return db;
}
