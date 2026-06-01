/**
 * [INPUT]: 依赖 fs 读取 schema.sql，依赖 better-sqlite3 执行 DDL
 * [OUTPUT]: 对外提供 migrate 函数，按需补齐旧库缺失的添加性字段，并重建 conversation_participants 以补齐外键与检查约束
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

  const participantSchema = db
    .prepare("select sql from sqlite_master where type = 'table' and name = 'conversation_participants'")
    .get() as { sql: string | null } | undefined;

  const participantSql = (participantSchema?.sql ?? "").toLowerCase();
  const hasParticipantForeignKeys =
    participantSql.includes("references conversations(id)") &&
    participantSql.includes("references people(id)") &&
    participantSql.includes("references skills(id)");
  const hasParticipantChecks =
    participantSql.includes("check (position >= 0)") && participantSql.includes("check (is_active in (0, 1))");

  if (!hasParticipantForeignKeys || !hasParticipantChecks) {
    rebuildConversationParticipants(db);
  }

  db.exec(`
    create trigger if not exists people_validate_persona_metadata_insert
    before insert on people
    when new.origin_type not in ('seed', 'nuwa_import', 'manual', 'distilled')
      or new.persona_kind not in ('person', 'topic')
      or new.is_archived not in (0, 1)
      or new.is_deleted not in (0, 1)
    begin
      select raise(abort, 'invalid persona metadata');
    end;
  `);

  db.exec(`
    create trigger if not exists people_validate_persona_metadata_update
    before update on people
    when new.origin_type not in ('seed', 'nuwa_import', 'manual', 'distilled')
      or new.persona_kind not in ('person', 'topic')
      or new.is_archived not in (0, 1)
      or new.is_deleted not in (0, 1)
    begin
      select raise(abort, 'invalid persona metadata');
    end;
  `);
}

function rebuildConversationParticipants(db: Database.Database) {
  const rebuild = db.transaction(() => {
    db.exec("drop table if exists conversation_participants_legacy");
    db.exec("alter table conversation_participants rename to conversation_participants_legacy");
    db.exec(`
      create table conversation_participants (
        conversation_id text not null references conversations(id) on delete cascade,
        person_id text not null references people(id) on delete cascade,
        skill_id text not null references skills(id) on delete cascade,
        join_source text not null,
        position integer not null check (position >= 0),
        is_active integer not null default 1 check (is_active in (0, 1)),
        primary key (conversation_id, person_id, skill_id)
      );
    `);
    db.exec(`
      with valid_legacy as (
        select
          legacy.conversation_id,
          legacy.person_id,
          legacy.skill_id,
          legacy.join_source,
          legacy.position,
          legacy.is_active,
          row_number() over (
            partition by legacy.conversation_id, legacy.person_id, legacy.skill_id
            order by legacy.rowid
          ) as row_number
        from conversation_participants_legacy legacy
        join conversations on conversations.id = legacy.conversation_id
        join people on people.id = legacy.person_id
        join skills on skills.id = legacy.skill_id
        where legacy.position >= 0
          and legacy.is_active in (0, 1)
      )
      insert into conversation_participants (
        conversation_id,
        person_id,
        skill_id,
        join_source,
        position,
        is_active
      )
      select
        conversation_id,
        person_id,
        skill_id,
        join_source,
        position,
        is_active
      from valid_legacy
      where row_number = 1;
    `);
    db.exec("drop table conversation_participants_legacy");
  });

  rebuild();
}
