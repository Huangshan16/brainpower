# server/db/

> L2 | 父级: ../AGENTS.md

成员清单
connection.ts: better-sqlite3 连接边界，开启 foreign_keys 并返回同步 SQLite 句柄
migrate.ts: SQLite schema 初始化器，读取 schema.sql 并执行 DDL
schema.sql: Digital Mentor Matrix 核心 SQLite DDL，定义 people/sources/fragments/skills/evaluations/critiques/jobs 七表

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
