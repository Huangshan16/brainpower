/**
 * [INPUT]: 依赖 better-sqlite3、nanoid 与 shared conversation/message schema 管理会话、参与者与消息持久化
 * [OUTPUT]: 对外提供 createConversationService 工厂与 conversation/participant/message 读写方法
 * [POS]: server/services 的会话真相源，被 conversationRoutes、conversationRunService 与测试消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import {
  ConversationParticipantSchema,
  ConversationSchema,
  MessageSchema,
  type Conversation,
  type ConversationParticipant,
  type Message
} from "../../shared/schemas.js";

type ConversationRow = {
  id: string;
  title: string;
  mode: Conversation["mode"];
  status: Conversation["status"];
  created_at: string;
  updated_at: string;
};

type ParticipantRow = {
  conversation_id: string;
  person_id: string;
  skill_id: string;
  join_source: string;
  position: number;
  is_active: number;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_type: Message["senderType"];
  sender_id: string;
  content: string;
  round_index: number;
  reply_to_message_id: string | null;
  meta_json: string;
  created_at: string;
};

type AddParticipantInput = {
  conversationId: string;
  personId: string;
  skillId: string;
  joinSource: string;
  position?: number;
};

type CreateMessageInput = {
  conversationId: string;
  senderType?: Message["senderType"];
  senderId?: string;
  content: string;
  replyToMessageId?: string | null;
  meta?: Record<string, unknown>;
};

function now() {
  return new Date().toISOString();
}

function parseMeta(value: string) {
  const parsed = JSON.parse(value) as unknown;
  return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
}

function mapConversation(row: ConversationRow): Conversation {
  return ConversationSchema.parse({
    id: row.id,
    title: row.title,
    mode: row.mode,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

function mapParticipant(row: ParticipantRow): ConversationParticipant {
  return ConversationParticipantSchema.parse({
    conversationId: row.conversation_id,
    personId: row.person_id,
    skillId: row.skill_id,
    joinSource: row.join_source,
    position: row.position,
    isActive: Boolean(row.is_active)
  });
}

function mapMessage(row: MessageRow): Message {
  return MessageSchema.parse({
    id: row.id,
    conversationId: row.conversation_id,
    senderType: row.sender_type,
    senderId: row.sender_id,
    content: row.content,
    roundIndex: row.round_index,
    replyToMessageId: row.reply_to_message_id,
    meta: parseMeta(row.meta_json),
    createdAt: row.created_at
  });
}

function getConversationRow(db: Database.Database, conversationId: string) {
  return db.prepare("select * from conversations where id = ?").get(conversationId) as ConversationRow | undefined;
}

function getMessageRow(db: Database.Database, messageId: string) {
  return db.prepare("select * from messages where id = ?").get(messageId) as MessageRow | undefined;
}

function getNextParticipantPosition(db: Database.Database, conversationId: string) {
  const row = db
    .prepare("select coalesce(max(position), -1) as position from conversation_participants where conversation_id = ?")
    .get(conversationId) as { position: number };

  return row.position + 1;
}

function getNextRoundIndex(
  db: Database.Database,
  conversationId: string,
  senderType: Message["senderType"],
  replyToMessageId?: string | null
) {
  if (replyToMessageId) {
    const replied = getMessageRow(db, replyToMessageId);

    if (!replied) {
      throw new Error("Reply target message not found");
    }

    if (replied.conversation_id !== conversationId) {
      throw new Error("Reply target message must belong to the same conversation");
    }

    return replied.round_index;
  }

  const row = db
    .prepare("select coalesce(max(round_index), -1) as round_index from messages where conversation_id = ?")
    .get(conversationId) as { round_index: number };

  return senderType === "user" ? row.round_index + 1 : Math.max(row.round_index, 0);
}

export function createConversationService(db: Database.Database) {
  return {
    createConversation(input: { title: string; mode: Conversation["mode"] }) {
      const id = nanoid();
      const timestamp = now();

      db.prepare(
        "insert into conversations (id, title, mode, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?)"
      ).run(id, input.title, input.mode, "active", timestamp, timestamp);

      return mapConversation(getConversationRow(db, id) as ConversationRow);
    },

    listConversations() {
      const rows = db
        .prepare("select * from conversations order by created_at asc, id asc")
        .all() as ConversationRow[];

      return rows.map(mapConversation);
    },

    addParticipant(input: AddParticipantInput) {
      if (!getConversationRow(db, input.conversationId)) {
        throw new Error("Conversation not found");
      }

      db.prepare(
        `insert into conversation_participants (
          conversation_id, person_id, skill_id, join_source, position, is_active
        ) values (?, ?, ?, ?, ?, ?)`
      ).run(
        input.conversationId,
        input.personId,
        input.skillId,
        input.joinSource,
        input.position ?? getNextParticipantPosition(db, input.conversationId),
        1
      );

      const row = db
        .prepare(
          "select * from conversation_participants where conversation_id = ? and person_id = ? and skill_id = ?"
        )
        .get(input.conversationId, input.personId, input.skillId) as ParticipantRow | undefined;

      if (!row) {
        throw new Error("Conversation participant insert failed");
      }

      return mapParticipant(row);
    },

    removeParticipant(conversationId: string, personId: string, skillId: string) {
      const result = db
        .prepare("delete from conversation_participants where conversation_id = ? and person_id = ? and skill_id = ?")
        .run(conversationId, personId, skillId);

      if (result.changes === 0) {
        throw new Error("Conversation participant not found");
      }
    },

    listParticipants(conversationId: string) {
      const rows = db
        .prepare("select * from conversation_participants where conversation_id = ? order by position asc, person_id asc")
        .all(conversationId) as ParticipantRow[];

      return rows.map(mapParticipant);
    },

    createMessage(input: CreateMessageInput) {
      if (!getConversationRow(db, input.conversationId)) {
        throw new Error("Conversation not found");
      }

      const id = nanoid();
      const senderType = input.senderType ?? "user";
      const senderId = input.senderId ?? "user";
      const roundIndex = getNextRoundIndex(db, input.conversationId, senderType, input.replyToMessageId);
      const createdAt = now();

      db.prepare(
        `insert into messages (
          id, conversation_id, sender_type, sender_id, content, round_index, reply_to_message_id, meta_json, created_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        input.conversationId,
        senderType,
        senderId,
        input.content,
        roundIndex,
        input.replyToMessageId ?? null,
        JSON.stringify(input.meta ?? {}),
        createdAt
      );

      return mapMessage(getMessageRow(db, id) as MessageRow);
    },

    listMessages(conversationId: string) {
      const rows = db
        .prepare("select * from messages where conversation_id = ? order by round_index asc, rowid asc")
        .all(conversationId) as MessageRow[];

      return rows.map(mapMessage);
    },

    getMessage(messageId: string) {
      const row = getMessageRow(db, messageId);
      return row ? mapMessage(row) : null;
    },

    messageBelongsToConversation(conversationId: string, messageId: string) {
      const row = getMessageRow(db, messageId);
      return row ? row.conversation_id === conversationId : false;
    }
  };
}
