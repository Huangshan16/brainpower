/**
 * [INPUT]: 依赖 better-sqlite3、nanoid 与 shared PersonaSchema 执行 persona 库读写与软删除
 * [OUTPUT]: 对外提供 createPersonaLibraryService 工厂、手工创建、导入去重、列表与软删除方法
 * [POS]: server/services 的 persona 库业务边界，被 personaRoutes、app 与服务测试消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import { PersonaSchema, type Persona } from "../../shared/schemas.js";

type PersonaRow = {
  id: string;
  name: string;
  role: Persona["role"];
  region: string;
  tags: string;
  status: Persona["status"];
  notes: string | null;
  origin_type: Persona["originType"];
  origin_ref: string | null;
  persona_kind: Persona["personaKind"];
  is_archived: number;
  is_deleted: number;
};

type PersonaInput = {
  name: string;
  role: Persona["role"];
  region: string;
  tags: string[];
  notes?: string;
};

type ImportedPersonaInput = {
  name: string;
  role: Persona["role"];
  region: string;
  tags: string[];
  originType: Persona["originType"];
  originRef: string;
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

function now() {
  return new Date().toISOString();
}

function parseTags(value: string) {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function mapPersona(row: PersonaRow): Persona {
  return PersonaSchema.parse({
    id: row.id,
    name: row.name,
    role: row.role,
    region: row.region,
    tags: parseTags(row.tags),
    status: row.status,
    notes: row.notes ?? undefined,
    originType: row.origin_type,
    originRef: row.origin_ref,
    personaKind: row.persona_kind,
    isArchived: Boolean(row.is_archived),
    isDeleted: Boolean(row.is_deleted)
  });
}

function selectPersonaById(db: Database.Database, id: string) {
  return db
    .prepare(
      "select id, name, role, region, tags, status, notes, origin_type, origin_ref, persona_kind, is_archived, is_deleted from people where id = ?"
    )
    .get(id) as PersonaRow | undefined;
}

function selectPersonaByOriginRef(db: Database.Database, originRef: string) {
  const canonicalOriginRef = canonicalizeOriginRef(originRef);

  if (!canonicalOriginRef.startsWith("nuwa-skill:")) {
    return db
      .prepare(
        "select id, name, role, region, tags, status, notes, origin_type, origin_ref, persona_kind, is_archived, is_deleted from people where origin_ref = ? order by created_at asc limit 1"
      )
      .get(canonicalOriginRef) as PersonaRow | undefined;
  }

  const rows = db
    .prepare(
      "select id, name, role, region, tags, status, notes, origin_type, origin_ref, persona_kind, is_archived, is_deleted from people where origin_type = 'nuwa_import' and origin_ref like 'nuwa-skill:%' order by created_at asc, id asc"
    )
    .all() as PersonaRow[];

  return rows.find((row) => row.origin_ref && canonicalizeOriginRef(row.origin_ref) === canonicalOriginRef);
}

function insertPersona(
  db: Database.Database,
  input: {
    name: string;
    role: Persona["role"];
    region: string;
    tags: string[];
    notes?: string;
    originType: Persona["originType"];
    originRef: string | null;
  }
) {
  const id = nanoid();
  const timestamp = now();

  db.prepare(
    `insert into people (
      id, name, role, region, tags, status, notes, origin_type, origin_ref, persona_kind, is_archived, is_deleted, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.name,
    input.role,
    input.region,
    JSON.stringify(input.tags),
    "needs_research",
    input.notes ?? null,
    input.originType,
    input.originRef,
    "person",
    0,
    0,
    timestamp,
    timestamp
  );

  const row = selectPersonaById(db, id);

  if (!row) {
    throw new Error("Persona insert failed");
  }

  return mapPersona(row);
}

function updatePersona(
  db: Database.Database,
  row: PersonaRow,
  input: {
    name: string;
    role: Persona["role"];
    region: string;
    tags: string[];
    originType: Persona["originType"];
    originRef: string | null;
    restoreVisibility?: boolean;
  }
) {
  const timestamp = now();

  db.prepare(
    `update people
     set name = ?, role = ?, region = ?, tags = ?, origin_type = ?, origin_ref = ?, is_deleted = ?, updated_at = ?
     where id = ?`
  ).run(
    input.name,
    input.role,
    input.region,
    JSON.stringify(input.tags),
    input.originType,
    input.originRef,
    input.restoreVisibility ? 0 : row.is_deleted,
    timestamp,
    row.id
  );

  const updated = selectPersonaById(db, row.id);

  if (!updated) {
    throw new Error("Persona update failed");
  }

  return mapPersona(updated);
}

export function createPersonaLibraryService(db: Database.Database) {
  return {
    createManualPersona(input: PersonaInput): Persona {
      return insertPersona(db, {
        ...input,
        originType: "manual",
        originRef: null
      });
    },

    upsertImportedPersonas(input: ImportedPersonaInput[]): Persona[] {
      const seen = new Map<string, ImportedPersonaInput>();
      const ordered: ImportedPersonaInput[] = [];

      for (const persona of input) {
        const key = persona.originRef;

        if (seen.has(key)) {
          continue;
        }

        seen.set(key, persona);
        ordered.push(persona);
      }

      return ordered.map((persona) => {
        const existing = selectPersonaByOriginRef(db, persona.originRef);

        if (!existing) {
          return insertPersona(db, {
            name: persona.name,
            role: persona.role,
            region: persona.region,
            tags: persona.tags,
            originType: persona.originType,
            originRef: canonicalizeOriginRef(persona.originRef)
          });
        }

        return updatePersona(db, existing, {
          name: persona.name,
          role: persona.role,
          region: persona.region,
          tags: persona.tags,
          originType: persona.originType,
          originRef: canonicalizeOriginRef(persona.originRef),
          restoreVisibility: true
        });
      });
    },

    listPeople(): Persona[] {
      const rows = db
        .prepare(
          "select id, name, role, region, tags, status, notes, origin_type, origin_ref, persona_kind, is_archived, is_deleted from people where is_deleted = 0 order by created_at asc, name asc"
        )
        .all() as PersonaRow[];

      return rows.map(mapPersona);
    },

    softDeletePersona(personId: string) {
      const timestamp = now();
      const result = db.prepare("update people set is_deleted = 1, updated_at = ? where id = ?").run(timestamp, personId);

      if (result.changes === 0) {
        throw new Error("Persona not found");
      }
    }
  };
}
