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

type ModelService = Pick<ReturnType<typeof createModelService>, "completeText">;
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

type PersonaIdentity = {
  id: string;
  name: string;
};

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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

function getPersonaIdentity(db: Database.Database, personId: string): PersonaIdentity {
  const row = db.prepare("select id, name from people where id = ?").get(personId) as PersonaIdentity | undefined;
  return row ?? { id: personId, name: personId };
}

async function generateReply(
  model: ModelService,
  input: {
    conversationId: string;
    personId: string;
    personName: string;
    userMessage: string;
    mode: "direct" | "group";
  }
) {
  const raw = await model.completeText(
    `You are ${input.personName}. Reply only as ${input.personName}. Do not write lines for any other speaker. Return only the reply body in plain text with no JSON and no markdown fences.`,
    JSON.stringify(input)
  );

  try {
    const parsed = JSON.parse(raw) as Partial<ReplyPayload>;

    if (parsed.reply) {
      return parsed.reply;
    }
  } catch {
    // 某些模型仍会返回接近 JSON 的文本，但聊天链路只需要最终可展示的正文。
  }

  const reply = raw.trim();

  if (!reply) {
    throw new Error("Conversation reply payload missing reply");
  }

  return reply;
}

function buildGroupPrompt(conversations: ConversationService, conversationId: string, rootMessageId: string, round: number) {
  const recent = conversations
    .listMessages(conversationId)
    .slice(-6)
    .map((message) => `${message.senderType}:${message.senderId}: ${message.content.slice(0, 600)}`)
    .join("\n");

  return round === 0 ? recent : `第 ${round + 1} 轮群聊，请基于最近消息继续回应、反驳或补充。\n${recent}\nroot:${rootMessageId}`;
}

function isRunStillRunning(db: Database.Database, runId: string) {
  const row = getRunRow(db, runId);
  return row?.status === "running";
}

export function createConversationRunService({
  db,
  conversations,
  model,
  maxRounds = 3,
  roundDelayMs = 1200
}: {
  db: Database.Database;
  conversations: ConversationService;
  model: ModelService;
  maxRounds?: number;
  roundDelayMs?: number;
}) {
  async function processGroupRun(runId: string, input: { conversationId: string; messageId: string }) {
    const sourceMessage = conversations.getMessage(input.messageId);

    if (!sourceMessage) {
      db.prepare("update conversation_runs set status = ?, stop_reason = ?, updated_at = ? where id = ?").run(
        "failed",
        "source_message_missing",
        now(),
        runId
      );
      return;
    }

    const participants = conversations.listParticipants(input.conversationId).filter((participant) => participant.isActive);

    if (participants.length === 0) {
      conversations.createMessage({
        conversationId: input.conversationId,
        senderType: "system",
        senderId: "system",
        content: "没有可参与群聊的人物。",
        replyToMessageId: input.messageId,
        meta: { runId, mode: "group", participantCount: 0 }
      });
      db.prepare("update conversation_runs set status = ?, updated_at = ? where id = ?").run("completed", now(), runId);
      return;
    }

    try {
      for (let round = 0; round < maxRounds; round += 1) {
        if (!isRunStillRunning(db, runId)) {
          return;
        }

        const prompt = buildGroupPrompt(conversations, input.conversationId, input.messageId, round);
        const identities = new Map(participants.map((participant) => [participant.personId, getPersonaIdentity(db, participant.personId)]));
        const replies = await Promise.all(
          participants.map(async (participant) => ({
            participant,
            reply: await generateReply(model, {
              conversationId: input.conversationId,
              personId: participant.personId,
              personName: identities.get(participant.personId)?.name ?? participant.personId,
              userMessage: prompt,
              mode: "group"
            })
          }))
        );

        if (!isRunStillRunning(db, runId)) {
          return;
        }

        for (const { participant, reply } of replies) {
          conversations.createMessage({
            conversationId: input.conversationId,
            senderType: "persona",
            senderId: participant.personId,
            content: reply,
            replyToMessageId: input.messageId,
            meta: { runId, mode: "group", skillId: participant.skillId, round: round + 1 }
          });
        }

        conversations.createMessage({
          conversationId: input.conversationId,
          senderType: "system",
          senderId: "system",
          content: round + 1 >= maxRounds ? `群聊已完成第 ${round + 1} 轮，并自动结束。` : `群聊已完成第 ${round + 1} 轮，准备进入下一轮。`,
          replyToMessageId: input.messageId,
          meta: { runId, mode: "group", participantCount: participants.length, round: round + 1 }
        });

        if (round + 1 >= maxRounds) {
          db.prepare("update conversation_runs set status = ?, updated_at = ? where id = ?").run("completed", now(), runId);
          return;
        }

        await wait(roundDelayMs);
      }
    } catch (error) {
      try {
        conversations.createMessage({
          conversationId: input.conversationId,
          senderType: "system",
          senderId: "system",
          content: error instanceof Error ? `群聊中断：${error.message}` : "群聊中断。",
          replyToMessageId: input.messageId,
          meta: { runId, mode: "group", failed: true }
        });
        db.prepare("update conversation_runs set status = ?, stop_reason = ?, updated_at = ? where id = ?").run(
          "failed",
          error instanceof Error ? error.message : "group_run_failed",
          now(),
          runId
        );
      } catch {
        // 后台 run 在进程退出或测试关闭数据库后无需继续上报失败消息。
      }
    }
  }

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
        personName: getPersonaIdentity(db, input.speakerPersonId).name,
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
      void processGroupRun(id, input);

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

      if (row.mode === "group") {
        conversations.createMessage({
          conversationId: row.conversation_id,
          senderType: "system",
          senderId: "system",
          content: "群聊已终止。",
          replyToMessageId: row.message_id,
          meta: { runId, mode: "group", stopped: true }
        });
      }

      return mapConversationRun(getRunRow(db, runId) as ConversationRunRow);
    }
  };
}
