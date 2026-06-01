/**
 * [INPUT]: 依赖 better-sqlite3、conversationService 与 distillationService 协调 run 持久化和 persona 回复
 * [OUTPUT]: 对外提供 createConversationRunService 工厂与 direct/group/start/stop/get 方法
 * [POS]: server/services 的会话运行边界，被 conversationRoutes 消费并把消息生成与 run 状态收敛到单一真相源
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import { ConversationRunSchema, type ConversationRun } from "../../shared/schemas.js";
import type { createConversationService } from "./conversationService.js";
import type { createDistillationService } from "./distillationService.js";

type ConversationService = ReturnType<typeof createConversationService>;
type DistillationService = ReturnType<typeof createDistillationService>;

type ConversationRunRow = {
  id: string;
  conversation_id: string;
  mode: ConversationRun["mode"];
  status: ConversationRun["status"];
  message_id: string;
  speaker_person_id: string | null;
  stop_reason: string | null;
  created_at: string;
  updated_at: string;
};

function now() {
  return new Date().toISOString();
}

function mapRun(row: ConversationRunRow): ConversationRun {
  return ConversationRunSchema.parse({
    id: row.id,
    conversationId: row.conversation_id,
    mode: row.mode,
    status: row.status,
    messageId: row.message_id,
    speakerPersonId: row.speaker_person_id,
    stopReason: row.stop_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

function createDefaultDistillationService(db: Database.Database) {
  return {
    generatePersonaReply(input: {
      conversationId: string;
      messageId: string;
      speakerPersonId: string;
      mode: "direct" | "group";
      prompt: string;
    }) {
      const person = db.prepare("select name from people where id = ?").get(input.speakerPersonId) as { name: string } | undefined;

      if (!person) {
        throw new Error("Persona not found");
      }

      return {
        content: `${person.name}: ${input.mode === "group" ? "群聊首轮判断" : "直接回复"}。${input.prompt}`.trim(),
        meta: {
          source: "conversation_run_fallback",
          conversationId: input.conversationId,
          messageId: input.messageId,
          mode: input.mode
        }
      };
    }
  };
}

function requirePrompt(db: Database.Database, conversationId: string, messageId: string) {
  const row = db
    .prepare("select content, round_index from messages where id = ? and conversation_id = ?")
    .get(messageId, conversationId) as { content: string; round_index: number } | undefined;

  if (!row) {
    throw new Error("Prompt message not found");
  }

  return row;
}

function requireRun(db: Database.Database, runId: string) {
  const row = db.prepare("select * from conversation_runs where id = ?").get(runId) as ConversationRunRow | undefined;

  if (!row) {
    throw new Error("Conversation run not found");
  }

  return row;
}

function insertRun(
  db: Database.Database,
  input: {
    conversationId: string;
    mode: ConversationRun["mode"];
    status: ConversationRun["status"];
    messageId: string;
    speakerPersonId: string | null;
    stopReason?: string | null;
  }
) {
  const id = nanoid();
  const timestamp = now();

  db.prepare(
    `insert into conversation_runs (
      id, conversation_id, mode, status, message_id, speaker_person_id, stop_reason, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.conversationId,
    input.mode,
    input.status,
    input.messageId,
    input.speakerPersonId,
    input.stopReason ?? null,
    timestamp,
    timestamp
  );

  return mapRun(db.prepare("select * from conversation_runs where id = ?").get(id) as ConversationRunRow);
}

export function createConversationRunService({
  db,
  conversations,
  distillation = createDefaultDistillationService(db)
}: {
  db: Database.Database;
  conversations: ConversationService;
  distillation?: DistillationService;
}) {
  return {
    getRun(runId: string): ConversationRun {
      return mapRun(requireRun(db, runId));
    },

    async startDirectRun(input: {
      conversationId: string;
      messageId: string;
      speakerPersonId: string;
    }): Promise<ConversationRun> {
      const prompt = requirePrompt(db, input.conversationId, input.messageId);
      const reply = distillation.generatePersonaReply({
        conversationId: input.conversationId,
        messageId: input.messageId,
        speakerPersonId: input.speakerPersonId,
        mode: "direct",
        prompt: prompt.content
      });
      const message = conversations.createMessage({
        conversationId: input.conversationId,
        senderType: "persona",
        senderId: input.speakerPersonId,
        content: reply.content,
        roundIndex: prompt.round_index,
        replyToMessageId: input.messageId,
        meta: reply.meta
      });

      return insertRun(db, {
        conversationId: input.conversationId,
        mode: "direct",
        status: "completed",
        messageId: message.id,
        speakerPersonId: input.speakerPersonId
      });
    },

    async startGroupRun(input: {
      conversationId: string;
      messageId: string;
    }): Promise<ConversationRun> {
      const prompt = requirePrompt(db, input.conversationId, input.messageId);
      const [participant] = conversations.listParticipants(input.conversationId);

      if (!participant) {
        throw new Error("Group run requires at least one participant");
      }

      conversations.createMessage({
        conversationId: input.conversationId,
        senderType: "system",
        senderId: "orchestrator",
        content: "进入群聊首轮。",
        roundIndex: prompt.round_index,
        replyToMessageId: input.messageId,
        meta: { source: "conversation_run", mode: "group" }
      });

      const reply = distillation.generatePersonaReply({
        conversationId: input.conversationId,
        messageId: input.messageId,
        speakerPersonId: participant.personId,
        mode: "group",
        prompt: prompt.content
      });
      const personaMessage = conversations.createMessage({
        conversationId: input.conversationId,
        senderType: "persona",
        senderId: participant.personId,
        content: reply.content,
        roundIndex: prompt.round_index,
        replyToMessageId: input.messageId,
        meta: reply.meta
      });

      return insertRun(db, {
        conversationId: input.conversationId,
        mode: "group",
        status: "running",
        messageId: personaMessage.id,
        speakerPersonId: participant.personId
      });
    },

    async stopRun(runId: string, reason: string): Promise<ConversationRun> {
      requireRun(db, runId);
      db.prepare(
        `update conversation_runs
         set status = 'stopped', stop_reason = ?, updated_at = ?
         where id = ?`
      ).run(reason, now(), runId);

      return mapRun(requireRun(db, runId));
    }
  };
}
