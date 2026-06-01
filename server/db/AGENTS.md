# server/db/

> L2 | 父级: ../AGENTS.md

成员清单
connection.ts: better-sqlite3 连接边界，开启 foreign_keys 并返回同步 SQLite 句柄
migrate.ts: SQLite schema 初始化器，读取 schema.sql、归一化 persona origin_ref、补齐唯一索引并按需重建 participants/messages/runs 表，迁移到“每会话每人物唯一 + 可空 skill 快照”
schema.sql: Digital Mentor Matrix 核心 SQLite DDL，定义 people/source/fragment/skill/evaluation/critique/job/conversation/message/run 边界，其中会话参与者允许先入场后蒸馏 skill

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
