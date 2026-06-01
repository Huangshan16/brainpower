/**
 * [INPUT]: 依赖 fs 读取 schema.sql，依赖 better-sqlite3 执行 DDL
 * [OUTPUT]: 对外提供 migrate 函数，按需补齐旧库缺失的添加性字段、归一化 persona origin_ref，并重建 conversation_participants/messages/conversation_runs 以补齐约束
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

  normalizePersonaOriginRefs(db);
  db.exec("create unique index if not exists people_origin_ref_unique on people(origin_ref) where origin_ref is not null");

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
  const hasNullableSkill =
    participantSql.includes("skill_id text references skills(id) on delete set null") &&
    participantSql.includes("primary key (conversation_id, person_id)");

  if (!hasParticipantForeignKeys || !hasParticipantChecks || !hasNullableSkill) {
    rebuildConversationParticipants(db);
  }

  ensureMessagesTable(db);
  ensureConversationRunsTable(db);

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

type OriginRefRow = {
  id: string;
  origin_ref: string;
  is_deleted: number;
  created_at: string;
};

function canonicalizeOriginRef(originRef: string) {
  if (!originRef.startsWith("nuwa-skill:")) {
    return originRef;
  }

  return `nuwa-skill:${originRef
    .slice("nuwa-skill:".length)
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, "-")}`;
}

function normalizePersonaOriginRefs(db: Database.Database) {
  const normalize = db.transaction(() => {
    const rows = db
      .prepare(
        "select id, origin_ref, is_deleted, created_at from people where origin_ref is not null order by created_at asc, id asc"
      )
      .all() as OriginRefRow[];
    const groups = new Map<string, OriginRefRow[]>();

    for (const row of rows) {
      const canonicalOriginRef = canonicalizeOriginRef(row.origin_ref);

      if (canonicalOriginRef !== row.origin_ref) {
        db.prepare("update people set origin_ref = ?, updated_at = current_timestamp where id = ?").run(canonicalOriginRef, row.id);
      }

      const group = groups.get(canonicalOriginRef) ?? [];
      group.push({ ...row, origin_ref: canonicalOriginRef });
      groups.set(canonicalOriginRef, group);
    }

    for (const [canonicalOriginRef, group] of groups.entries()) {
      if (group.length < 2) {
        continue;
      }

      const [survivor, ...duplicates] = [...group].sort((left, right) => {
        if (left.is_deleted !== right.is_deleted) {
          return left.is_deleted - right.is_deleted;
        }

        if (left.created_at !== right.created_at) {
          return left.created_at.localeCompare(right.created_at);
        }

        return left.id.localeCompare(right.id);
      });

      db.prepare("update people set origin_ref = ?, updated_at = current_timestamp where id = ?").run(
        canonicalOriginRef,
        survivor.id
      );

      for (const duplicate of duplicates) {
        reassignPersonReferences(db, duplicate.id, survivor.id);
        db.prepare("delete from people where id = ?").run(duplicate.id);
      }
    }
  });

  normalize();
}

function reassignPersonReferences(db: Database.Database, fromPersonId: string, toPersonId: string) {
  db.prepare("update sources set person_id = ? where person_id = ?").run(toPersonId, fromPersonId);
  db.prepare("update fragments set person_id = ? where person_id = ?").run(toPersonId, fromPersonId);
  db.prepare("update skills set person_id = ? where person_id = ?").run(toPersonId, fromPersonId);
  db.prepare("update evaluations set person_id = ? where person_id = ?").run(toPersonId, fromPersonId);
  db.prepare("update critiques set critic_person_id = ? where critic_person_id = ?").run(toPersonId, fromPersonId);
  db.prepare("update critiques set target_person_id = ? where target_person_id = ?").run(toPersonId, fromPersonId);
  db.prepare("update jobs set person_id = ? where person_id = ?").run(toPersonId, fromPersonId);
  db.prepare("update or ignore conversation_participants set person_id = ? where person_id = ?").run(toPersonId, fromPersonId);
  db.prepare("delete from conversation_participants where person_id = ?").run(fromPersonId);
}

function rebuildConversationParticipants(db: Database.Database) {
  const rebuild = db.transaction(() => {
    db.exec("drop table if exists conversation_participants_legacy");
    db.exec("alter table conversation_participants rename to conversation_participants_legacy");
    db.exec(`
      create table conversation_participants (
        conversation_id text not null references conversations(id) on delete cascade,
        person_id text not null references people(id) on delete cascade,
        skill_id text references skills(id) on delete set null,
        join_source text not null,
        position integer not null check (position >= 0),
        is_active integer not null default 1 check (is_active in (0, 1)),
        primary key (conversation_id, person_id)
      );
    `);
    db.exec(`
      with valid_legacy as (
        select
          legacy.conversation_id,
          legacy.person_id,
          skills.id as skill_id,
          legacy.join_source,
          legacy.position,
          legacy.is_active,
          row_number() over (
            partition by legacy.conversation_id, legacy.person_id
            order by case when skills.id is null then 1 else 0 end, legacy.rowid desc
          ) as row_number
        from conversation_participants_legacy legacy
        join conversations on conversations.id = legacy.conversation_id
        join people on people.id = legacy.person_id
        left join skills on skills.id = legacy.skill_id
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

function ensureMessagesTable(db: Database.Database) {
  const schema = db.prepare("select sql from sqlite_master where type = 'table' and name = 'messages'").get() as
    | { sql: string | null }
    | undefined;

  if (!schema) {
    db.exec(`
      create table messages (
        id text primary key,
        conversation_id text not null references conversations(id) on delete cascade,
        sender_type text not null check (sender_type in ('user', 'persona', 'system')),
        sender_id text not null,
        content text not null,
        round_index integer not null check (round_index >= 0),
        reply_to_message_id text references messages(id) on delete set null,
        meta_json text not null default '{}',
        created_at text not null
      );
    `);
    return;
  }

  const sql = (schema.sql ?? "").toLowerCase();
  const valid =
    sql.includes("references conversations(id)") &&
    sql.includes("sender_type") &&
    sql.includes("check (sender_type in ('user', 'persona', 'system'))") &&
    sql.includes("check (round_index >= 0)") &&
    sql.includes("meta_json");

  if (!valid) {
    rebuildMessagesTable(db);
  }
}

function rebuildMessagesTable(db: Database.Database) {
  const rebuild = db.transaction(() => {
    db.exec("drop table if exists messages_legacy");
    db.exec("alter table messages rename to messages_legacy");
    db.exec(`
      create table messages (
        id text primary key,
        conversation_id text not null references conversations(id) on delete cascade,
        sender_type text not null check (sender_type in ('user', 'persona', 'system')),
        sender_id text not null,
        content text not null,
        round_index integer not null check (round_index >= 0),
        reply_to_message_id text references messages(id) on delete set null,
        meta_json text not null default '{}',
        created_at text not null
      );
    `);
    db.exec(`
      insert into messages (
        id,
        conversation_id,
        sender_type,
        sender_id,
        content,
        round_index,
        reply_to_message_id,
        meta_json,
        created_at
      )
      select
        id,
        conversation_id,
        sender_type,
        sender_id,
        content,
        round_index,
        reply_to_message_id,
        coalesce(meta_json, '{}'),
        created_at
      from messages_legacy
      where sender_type in ('user', 'persona', 'system')
        and round_index >= 0;
    `);
    db.exec("drop table messages_legacy");
  });

  rebuild();
}

function ensureConversationRunsTable(db: Database.Database) {
  const schema = db.prepare("select sql from sqlite_master where type = 'table' and name = 'conversation_runs'").get() as
    | { sql: string | null }
    | undefined;

  if (!schema) {
    db.exec(`
      create table conversation_runs (
        id text primary key,
        conversation_id text not null references conversations(id) on delete cascade,
        mode text not null check (mode in ('direct', 'group')),
        status text not null check (status in ('running', 'stopped', 'completed', 'failed')),
        message_id text not null references messages(id) on delete cascade,
        speaker_person_id text references people(id) on delete set null,
        stop_reason text,
        created_at text not null,
        updated_at text not null
      );
    `);
    return;
  }

  const sql = (schema.sql ?? "").toLowerCase();
  const valid =
    sql.includes("references conversations(id)") &&
    sql.includes("references messages(id)") &&
    sql.includes("check (mode in ('direct', 'group'))") &&
    sql.includes("check (status in ('running', 'stopped', 'completed', 'failed'))");

  if (!valid) {
    rebuildConversationRunsTable(db);
  }
}

function rebuildConversationRunsTable(db: Database.Database) {
  const rebuild = db.transaction(() => {
    db.exec("drop table if exists conversation_runs_legacy");
    db.exec("alter table conversation_runs rename to conversation_runs_legacy");
    db.exec(`
      create table conversation_runs (
        id text primary key,
        conversation_id text not null references conversations(id) on delete cascade,
        mode text not null check (mode in ('direct', 'group')),
        status text not null check (status in ('running', 'stopped', 'completed', 'failed')),
        message_id text not null references messages(id) on delete cascade,
        speaker_person_id text references people(id) on delete set null,
        stop_reason text,
        created_at text not null,
        updated_at text not null
      );
    `);
    db.exec(`
      insert into conversation_runs (
        id,
        conversation_id,
        mode,
        status,
        message_id,
        speaker_person_id,
        stop_reason,
        created_at,
        updated_at
      )
      select
        legacy.id,
        legacy.conversation_id,
        legacy.mode,
        legacy.status,
        legacy.message_id,
        legacy.speaker_person_id,
        legacy.stop_reason,
        legacy.created_at,
        legacy.updated_at
      from conversation_runs_legacy legacy
      join conversations on conversations.id = legacy.conversation_id
      join messages on messages.id = legacy.message_id
      left join people on people.id = legacy.speaker_person_id
      where legacy.mode in ('direct', 'group')
        and legacy.status in ('running', 'stopped', 'completed', 'failed')
        and (legacy.speaker_person_id is null or people.id is not null);
    `);
    db.exec("drop table conversation_runs_legacy");
  });

  rebuild();
}
