/*
 * [INPUT]: 依赖 SQLite DDL 语法与 better-sqlite3 migrate 执行器
 * [OUTPUT]: 对外提供 people/sources/fragments/skills/evaluations/critiques/jobs/conversations/messages/conversation_runs 的建表语句
 * [POS]: server/db 的机器相骨架，被 migrate.ts 执行并定义后端持久化边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
create table if not exists people (
  id text primary key,
  name text not null,
  role text not null check (role in ('investor', 'entrepreneur', 'ai_builder')),
  region text not null,
  tags text not null default '[]',
  status text not null check (status in ('needs_research', 'researching', 'ready_to_distill', 'ready_to_evaluate')),
  notes text,
  origin_type text not null default 'seed' check (origin_type in ('seed', 'nuwa_import', 'manual', 'distilled')),
  origin_ref text,
  persona_kind text not null default 'person' check (persona_kind in ('person', 'topic')),
  is_archived integer not null default 0 check (is_archived in (0, 1)),
  is_deleted integer not null default 0 check (is_deleted in (0, 1)),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists sources (
  id text primary key,
  person_id text not null references people(id) on delete cascade,
  url text not null,
  title text not null,
  source_type text not null,
  trust_level text not null,
  crawl_status text not null,
  fetched_at text,
  created_at text not null
);

create table if not exists fragments (
  id text primary key,
  source_id text not null references sources(id) on delete cascade,
  person_id text not null references people(id) on delete cascade,
  content text not null,
  summary text not null,
  timeline_tag text not null,
  evidence_type text not null,
  created_at text not null
);

create table if not exists skills (
  id text primary key,
  person_id text not null references people(id) on delete cascade,
  version integer not null,
  mental_models_json text not null default '[]',
  heuristics_json text not null default '[]',
  voice_dna_json text not null default '[]',
  anti_patterns_json text not null default '[]',
  honesty_boundaries_json text not null default '[]',
  citations_json text not null default '[]',
  created_at text not null
);

create table if not exists evaluations (
  id text primary key,
  project_title text not null,
  project_brief text not null,
  skill_id text not null,
  person_id text not null,
  verdict text not null,
  person_judgment text not null,
  business_judgment text not null,
  risks_json text not null default '[]',
  questions_json text not null default '[]',
  score_json text not null default '{}',
  created_at text not null
);

create table if not exists critiques (
  id text primary key,
  evaluation_id text not null references evaluations(id) on delete cascade,
  critic_person_id text not null,
  target_person_id text not null,
  stance text not null,
  critique text not null,
  created_at text not null
);

create table if not exists jobs (
  id text primary key,
  type text not null check (type in ('crawl', 'research', 'distill', 'evaluate')),
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')),
  person_id text references people(id) on delete set null,
  input text not null default '[]',
  output text not null default '[]',
  error text,
  created_at text not null,
  updated_at text not null
);

create table if not exists conversations (
  id text primary key,
  title text not null,
  mode text not null check (mode in ('direct', 'group')),
  status text not null check (status in ('active', 'stopped', 'archived')),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists conversation_participants (
  conversation_id text not null references conversations(id) on delete cascade,
  person_id text not null references people(id) on delete cascade,
  skill_id text not null references skills(id) on delete cascade,
  join_source text not null,
  position integer not null check (position >= 0),
  is_active integer not null default 1 check (is_active in (0, 1)),
  primary key (conversation_id, person_id, skill_id)
);

create table if not exists messages (
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

create table if not exists conversation_runs (
  id text primary key,
  conversation_id text not null references conversations(id) on delete cascade,
  mode text not null check (mode in ('direct', 'group')),
  status text not null check (status in ('running', 'stopped', 'completed', 'failed')),
  message_id text not null references messages(id) on delete cascade,
  speaker_person_id text references people(id) on delete set null,
  stop_reason text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);
