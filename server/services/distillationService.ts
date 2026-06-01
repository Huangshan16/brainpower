/**
 * [INPUT]: 依赖 better-sqlite3、nanoid、personaLibraryService、nuwaGatewayService 与可选 conversationService 记录导入优先的蒸馏任务
 * [OUTPUT]: 对外提供 createDistillationService 工厂与 queueDistillation 方法
 * [POS]: server/services 的 import-first 蒸馏边界，被 skillRoutes 与后续 persona 流程消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import type { createConversationService } from "./conversationService.js";
import type { createNuwaGatewayService } from "./nuwaGatewayService.js";
import type { createPersonaLibraryService } from "./personaLibraryService.js";

function now() {
  return new Date().toISOString();
}

type PersonaLibraryService = ReturnType<typeof createPersonaLibraryService>;
type NuwaGatewayService = ReturnType<typeof createNuwaGatewayService>;
type ConversationService = ReturnType<typeof createConversationService>;

function findLatestSkillId(db: Database.Database, personId: string) {
  const row = db
    .prepare("select id from skills where person_id = ? order by version desc, created_at desc, id desc limit 1")
    .get(personId) as { id: string } | undefined;

  return row?.id ?? null;
}

function updateJob(
  db: Database.Database,
  input: {
    id: string;
    status: "queued" | "running" | "succeeded" | "failed";
    output: string[];
    error?: string | null;
  }
) {
  db.prepare("update jobs set status = ?, output = ?, error = ?, updated_at = ? where id = ?").run(
    input.status,
    JSON.stringify(input.output),
    input.error ?? null,
    now(),
    input.id
  );
}

export function createDistillationService({
  db,
  library,
  gateway,
  conversations
}: {
  db: Database.Database;
  library: PersonaLibraryService;
  gateway: NuwaGatewayService;
  conversations?: ConversationService;
}) {
  return {
    async queueDistillation(input: { name: string; conversationId?: string }) {
      const id = nanoid();
      const timestamp = now();
      const payload = [input.name, input.conversationId ?? ""].filter(Boolean);

      db.prepare(
        "insert into jobs (id, type, status, person_id, input, output, error, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(id, "distill", "queued", null, JSON.stringify(payload), JSON.stringify([]), null, timestamp, timestamp);

      try {
        const importedPersonas = await gateway.listImportedPersonas();
        const matched = importedPersonas.find((persona) => persona.name.toLowerCase() === input.name.trim().toLowerCase());

        if (!matched) {
          return {
            jobId: id,
            status: "queued" as const
          };
        }

        const [persona] = library.upsertImportedPersonas([matched]);
        const output = [persona.id];

        if (input.conversationId && conversations) {
          const latestSkillId = findLatestSkillId(db, persona.id);

          if (latestSkillId) {
            conversations.addParticipant({
              conversationId: input.conversationId,
              personId: persona.id,
              skillId: latestSkillId,
              joinSource: "distill_job"
            });
            output.push(input.conversationId);
          }
        }

        updateJob(db, {
          id,
          status: "succeeded",
          output
        });

        return {
          jobId: id,
          status: "succeeded" as const,
          personId: persona.id
        };
      } catch (error) {
        updateJob(db, {
          id,
          status: "failed",
          output: [],
          error: error instanceof Error ? error.message : "Distillation job failed"
        });
        throw error;
      }
    }
  };
}
