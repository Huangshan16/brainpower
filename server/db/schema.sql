create table if not exists people (
  id text primary key,
  name text not null,
  role text not null check (role in ('investor', 'entrepreneur', 'ai_builder')),
  region text not null,
  tags text not null default '[]',
  status text not null check (status in ('needs_research', 'researching', 'ready_to_distill', 'ready_to_evaluate')),
  notes text,
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
