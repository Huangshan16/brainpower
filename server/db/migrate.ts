/**
 * [INPUT]: 依赖 fs 读取 schema.sql，依赖 better-sqlite3 执行 DDL
 * [OUTPUT]: 对外提供 migrate 函数，按需补齐旧库缺失的添加性字段
 * [POS]: server/db 的 schema 初始化器，被启动流程与测试消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";

const here = dirname(fileURLToPath(import.meta.url));

export function migrate(db: Database.Database) {
  const sql = readFileSync(join(here, "schema.sql"), "utf8");
  db.exec(sql);

  const peopleColumns = new Set(
    (db.prepare("pragma table_info(people)").all() as Array<{ name: string }>).map((column) => column.name)
  );

  if (!peopleColumns.has("origin_type")) {
    db.exec("alter table people add column origin_type text not null default 'seed'");
  }

  if (!peopleColumns.has("origin_ref")) {
    db.exec("alter table people add column origin_ref text");
  }

  if (!peopleColumns.has("persona_kind")) {
    db.exec("alter table people add column persona_kind text not null default 'person'");
  }

  if (!peopleColumns.has("is_archived")) {
    db.exec("alter table people add column is_archived integer not null default 0");
  }

  if (!peopleColumns.has("is_deleted")) {
    db.exec("alter table people add column is_deleted integer not null default 0");
  }
}
