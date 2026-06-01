/**
 * [INPUT]: 依赖 better-sqlite3 持久化资料库实体，依赖 shared/schemas 统一前后端数据契约
 * [OUTPUT]: 对外提供 createLibraryService 工厂与人物、来源、片段读写方法，片段归属从 source 派生
 * [POS]: server/services 的资料库业务边界，被 Express 路由与服务测试消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import {
  FragmentSchema,
  PersonSchema,
  SourceSchema,
  type Fragment,
  type Person,
  type Source
} from "../../shared/schemas.js";

type PersonInput = {
  name: string;
  role: Person["role"];
  region: string;
  tags: string[];
  notes?: string;
};

type SourceInput = {
  personId: string;
  url: string;
  title: string;
  sourceType: string;
  trustLevel: string;
  crawlStatus: string;
};

type FragmentInput = {
  sourceId: string;
  personId: string;
  content: string;
  summary: string;
  timelineTag: string;
  evidenceType: string;
};

type PersonRow = {
  id: string;
  name: string;
  role: Person["role"];
  region: string;
  tags: string;
  status: Person["status"];
  notes: string | null;
};

type SourceRow = {
  id: string;
  person_id: string;
  url: string;
  title: string;
  source_type: string;
  trust_level: string;
  crawl_status: string;
  fetched_at: string | null;
  created_at: string;
};

type FragmentRow = {
  id: string;
  source_id: string;
  person_id: string;
  content: string;
  summary: string;
  timeline_tag: string;
  evidence_type: string;
  created_at: string;
};

function now() {
  return new Date().toISOString();
}

function parseStringArray(value: string) {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function mapPerson(row: PersonRow): Person {
  return PersonSchema.parse({
    id: row.id,
    name: row.name,
    role: row.role,
    region: row.region,
    tags: parseStringArray(row.tags),
    status: row.status,
    notes: row.notes ?? undefined
  });
}

function mapSource(row: SourceRow): Source {
  return SourceSchema.parse({
    id: row.id,
    personId: row.person_id,
    url: row.url,
    title: row.title,
    sourceType: row.source_type,
    trustLevel: row.trust_level,
    crawlStatus: row.crawl_status,
    fetchedAt: row.fetched_at,
    createdAt: row.created_at
  });
}

function mapFragment(row: FragmentRow): Fragment {
  return FragmentSchema.parse({
    id: row.id,
    sourceId: row.source_id,
    personId: row.person_id,
    content: row.content,
    summary: row.summary,
    timelineTag: row.timeline_tag,
    evidenceType: row.evidence_type,
    createdAt: row.created_at
  });
}

function getSourceOwner(db: Database.Database, sourceId: string) {
  const row = db.prepare("select person_id from sources where id = ?").get(sourceId) as { person_id: string } | undefined;

  if (!row) {
    throw new Error("Source not found");
  }

  return row.person_id;
}

export function createLibraryService(db: Database.Database) {
  return {
    createPerson(input: PersonInput): Person {
      const id = nanoid();
      const timestamp = now();
      const status: Person["status"] = "needs_research";

      db.prepare(
        `insert into people (id, name, role, region, tags, status, notes, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, input.name, input.role, input.region, JSON.stringify(input.tags), status, input.notes ?? null, timestamp, timestamp);

      return mapPerson(
        db.prepare("select id, name, role, region, tags, status, notes from people where id = ?").get(id) as PersonRow
      );
    },

    listPeople(): Person[] {
      const rows = db
        .prepare("select id, name, role, region, tags, status, notes from people where is_deleted = 0 order by created_at asc, name asc")
        .all() as PersonRow[];

      return rows.map(mapPerson);
    },

    createSource(input: SourceInput): Source {
      const id = nanoid();
      const timestamp = now();

      db.prepare(
        `insert into sources (id, person_id, url, title, source_type, trust_level, crawl_status, fetched_at, created_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        input.personId,
        input.url,
        input.title,
        input.sourceType,
        input.trustLevel,
        input.crawlStatus,
        null,
        timestamp
      );

      return mapSource(db.prepare("select * from sources where id = ?").get(id) as SourceRow);
    },

    createFragment(input: FragmentInput): Fragment {
      const id = nanoid();
      const timestamp = now();
      const personId = getSourceOwner(db, input.sourceId);

      if (input.personId !== personId) {
        throw new Error("Fragment personId must match source owner");
      }

      db.prepare(
        `insert into fragments (id, source_id, person_id, content, summary, timeline_tag, evidence_type, created_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        input.sourceId,
        personId,
        input.content,
        input.summary,
        input.timelineTag,
        input.evidenceType,
        timestamp
      );

      return mapFragment(db.prepare("select * from fragments where id = ?").get(id) as FragmentRow);
    },

    listFragments(personId: string): Fragment[] {
      const rows = db
        .prepare("select * from fragments where person_id = ? order by created_at asc, id asc")
        .all(personId) as FragmentRow[];

      return rows.map(mapFragment);
    }
  };
}
