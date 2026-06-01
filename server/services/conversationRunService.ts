/**
 * [INPUT]: 依赖 better-sqlite3、nanoid、conversationService 与 modelService 编排 direct/group 对话轮次
 * [OUTPUT]: 对外提供 createConversationRunService 工厂与 run 启停/查询方法
 * [POS]: server/services 的会话运行编排层，被 conversationRoutes 与测试消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import { ConversationRunSchema, type ConversationRun } from "../../shared/schemas.js";
import type { createModelService } from "./modelService.js";
import type { createConversationService } from "./conversationService.js";

type ModelService = ReturnType<typeof createModelService>;
type ConversationService = ReturnType<typeof createConversationService>;

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

type ReplyPayload = {
  reply: string;
};

function now() {
  return new Date().toISOString();
}

function mapConversationRun(row: ConversationRunRow): ConversationRun {
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

function getRunRow(db: Database.Database, runId: string) {
  return db.prepare("select * from conversation_runs where id = ?").get(runId) as ConversationRunRow | undefined;
}

async function generateReply(
  model: ModelService,
  input: {
    conversationId: string;
    personId: string;
    userMessage: string;
    mode: "direct" | "group";
  }
) {
  const raw = await model.completeJson(
    "Reply as the selected digital persona. Return JSON only with a single key: reply.",
    JSON.stringify(input)
  );
  const parsed = JSON.parse(raw) as Partial<ReplyPayload>;

  if (!parsed.reply) {
    throw new Error("Conversation reply payload missing reply");
  }

  return parsed.reply;
}

export function createConversationRunService({
  db,
  conversations,
  model
}: {
  db: Database.Database;
  conversations: ConversationService;
  model: ModelService;
}) {
  return {
    getRun(runId: string) {
      const row = getRunRow(db, runId);
      return row ? mapConversationRun(row) : null;
    },

    async startDirectRun(input: { conversationId: string; messageId: string; speakerPersonId: string }) {
      const sourceMessage = conversations.getMessage(input.messageId);

      if (!sourceMessage) {
        throw new Error("Message not found");
      }

      if (sourceMessage.conversationId !== input.conversationId) {
        throw new Error("Message must belong to the selected conversation");
      }

      const id = nanoid();
      const timestamp = now();

      db.prepare(
        `insert into conversation_runs (
          id, conversation_id, mode, status, message_id, speaker_person_id, stop_reason, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, input.conversationId, "direct", "running", input.messageId, input.speakerPersonId, null, timestamp, timestamp);

      const reply = await generateReply(model, {
        conversationId: input.conversationId,
        personId: input.speakerPersonId,
        userMessage: sourceMessage.content,
        mode: "direct"
      });

      conversations.createMessage({
        conversationId: input.conversationId,
        senderType: "persona",
        senderId: input.speakerPersonId,
        content: reply,
        replyToMessageId: input.messageId,
        meta: { runId: id, mode: "direct" }
      });

      db.prepare("update conversation_runs set status = ?, updated_at = ? where id = ?").run("completed", now(), id);

      return mapConversationRun(getRunRow(db, id) as ConversationRunRow);
    },

    async startGroupRun(input: { conversationId: string; messageId: string }) {
      const sourceMessage = conversations.getMessage(input.messageId);

      if (!sourceMessage) {
        throw new Error("Message not found");
      }

      if (sourceMessage.conversationId !== input.conversationId) {
        throw new Error("Message must belong to the selected conversation");
      }

      const id = nanoid();
      const timestamp = now();

      db.prepare(
        `insert into conversation_runs (
          id, conversation_id, mode, status, message_id, speaker_person_id, stop_reason, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, input.conversationId, "group", "running", input.messageId, null, null, timestamp, timestamp);

      const participants = conversations.listParticipants(input.conversationId).filter((participant) => participant.isActive);

      for (const participant of participants) {
        const reply = await generateReply(model, {
          conversationId: input.conversationId,
          personId: participant.personId,
          userMessage: sourceMessage.content,
          mode: "group"
        });

        conversations.createMessage({
          conversationId: input.conversationId,
          senderType: "persona",
          senderId: participant.personId,
          content: reply,
          replyToMessageId: input.messageId,
          meta: { runId: id, mode: "group", skillId: participant.skillId }
        });
      }

      conversations.createMessage({
        conversationId: input.conversationId,
        senderType: "system",
        senderId: "system",
        content: participants.length > 0 ? "群聊已完成当前轮次。" : "没有可参与群聊的人物。",
        replyToMessageId: input.messageId,
        meta: { runId: id, mode: "group", participantCount: participants.length }
      });

      db.prepare("update conversation_runs set updated_at = ? where id = ?").run(now(), id);

      return mapConversationRun(getRunRow(db, id) as ConversationRunRow);
    },

    stopRun(runId: string, reason: string, conversationId?: string) {
      const row = getRunRow(db, runId);

      if (!row) {
        throw new Error("Conversation run not found");
      }

      if (conversationId && row.conversation_id !== conversationId) {
        throw new Error("Conversation run does not belong to the selected conversation");
      }

      const timestamp = now();
      const result = db
        .prepare("update conversation_runs set status = ?, stop_reason = ?, updated_at = ? where id = ?")
        .run("stopped", reason, timestamp, runId);

      if (result.changes === 0) {
        throw new Error("Conversation run not found");
      }

      return mapConversationRun(getRunRow(db, runId) as ConversationRunRow);
    }
  };
}
