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
  name text not null,
  description text not null,
  principles text not null default '[]',
  evidence_fragment_ids text not null default '[]',
  confidence real not null check (confidence >= 0 and confidence <= 1)
);

create table if not exists evaluations (
  id text primary key,
  person_id text not null references people(id) on delete cascade,
  prompt text not null,
  output text not null,
  scores text not null default '[]',
  evidence_fragment_ids text not null default '[]',
  created_at text not null
);

create table if not exists critiques (
  id text primary key,
  evaluation_id text not null references evaluations(id) on delete cascade,
  strengths text not null default '[]',
  weaknesses text not null default '[]',
  missing_evidence text not null default '[]',
  recommendation text not null,
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
