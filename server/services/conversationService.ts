/**
 * [INPUT]: 依赖 better-sqlite3 持久化 conversations/conversation_participants/messages，依赖 shared/schemas 统一契约
 * [OUTPUT]: 对外提供 createConversationService 工厂与 conversation CRUD、participant、message 方法
 * [POS]: server/services 的会话持久化边界，被 conversationRoutes 与 conversationRunService 消费
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

type CreateConversationInput = {
  title: string;
  mode: Conversation["mode"];
};

type CreateParticipantInput = {
  conversationId: string;
  personId: string;
  skillId: string;
  joinSource: string;
};

type CreateMessageInput = {
  conversationId: string;
  senderType: Message["senderType"];
  senderId: string;
  content: string;
  roundIndex?: number;
  replyToMessageId?: string | null;
  meta?: Record<string, unknown>;
};

function now() {
  return new Date().toISOString();
}

function parseRecord(value: string) {
  const parsed = JSON.parse(value) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
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
    isActive: row.is_active === 1
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
    meta: parseRecord(row.meta_json),
    createdAt: row.created_at
  });
}

function requireConversation(db: Database.Database, conversationId: string) {
  const row = db.prepare("select * from conversations where id = ?").get(conversationId) as ConversationRow | undefined;

  if (!row) {
    throw new Error("Conversation not found");
  }

  return row;
}

function requireSkillOwnership(db: Database.Database, personId: string, skillId: string) {
  const row = db.prepare("select id from skills where id = ? and person_id = ?").get(skillId, personId) as { id: string } | undefined;

  if (!row) {
    throw new Error("Skill snapshot not found for participant");
  }
}

function touchConversation(db: Database.Database, conversationId: string) {
  db.prepare("update conversations set updated_at = ? where id = ?").run(now(), conversationId);
}

function inferRoundIndex(db: Database.Database, conversationId: string) {
  const row = db
    .prepare("select coalesce(max(round_index), -1) as max_round from messages where conversation_id = ?")
    .get(conversationId) as { max_round: number };

  return row.max_round + 1;
}

export function createConversationService(db: Database.Database) {
  return {
    createConversation(input: CreateConversationInput): Conversation {
      const id = nanoid();
      const timestamp = now();

      db.prepare(
        `insert into conversations (id, title, mode, status, created_at, updated_at)
         values (?, ?, ?, 'active', ?, ?)`
      ).run(id, input.title, input.mode, timestamp, timestamp);

      return mapConversation(db.prepare("select * from conversations where id = ?").get(id) as ConversationRow);
    },

    listConversations(): Conversation[] {
      const rows = db.prepare("select * from conversations order by created_at asc, id asc").all() as ConversationRow[];
      return rows.map(mapConversation);
    },

    getConversation(conversationId: string): Conversation {
      return mapConversation(requireConversation(db, conversationId));
    },

    addParticipant(input: CreateParticipantInput): ConversationParticipant {
      requireConversation(db, input.conversationId);
      requireSkillOwnership(db, input.personId, input.skillId);

      const positionRow = db
        .prepare("select coalesce(max(position), -1) as max_position from conversation_participants where conversation_id = ?")
        .get(input.conversationId) as { max_position: number };
      const position = positionRow.max_position + 1;

      db.prepare(
        `insert into conversation_participants (
          conversation_id, person_id, skill_id, join_source, position, is_active
        ) values (?, ?, ?, ?, ?, 1)`
      ).run(input.conversationId, input.personId, input.skillId, input.joinSource, position);

      touchConversation(db, input.conversationId);

      return mapParticipant(
        db.prepare(
          `select * from conversation_participants
           where conversation_id = ? and person_id = ? and skill_id = ?`
        ).get(input.conversationId, input.personId, input.skillId) as ParticipantRow
      );
    },

    listParticipants(conversationId: string): ConversationParticipant[] {
      requireConversation(db, conversationId);
      const rows = db
        .prepare(
          `select * from conversation_participants
           where conversation_id = ? and is_active = 1
           order by position asc, person_id asc, skill_id asc`
        )
        .all(conversationId) as ParticipantRow[];

      return rows.map(mapParticipant);
    },

    removeParticipant(conversationId: string, personId: string, skillId: string) {
      requireConversation(db, conversationId);
      db.prepare(
        `delete from conversation_participants
         where conversation_id = ? and person_id = ? and skill_id = ?`
      ).run(conversationId, personId, skillId);
      touchConversation(db, conversationId);
    },

    createMessage(input: CreateMessageInput): Message {
      requireConversation(db, input.conversationId);

      if (input.replyToMessageId) {
        const replyRow = db
          .prepare("select id from messages where id = ? and conversation_id = ?")
          .get(input.replyToMessageId, input.conversationId) as { id: string } | undefined;

        if (!replyRow) {
          throw new Error("Reply target not found in conversation");
        }
      }

      const id = nanoid();
      const createdAt = now();
      const roundIndex = input.roundIndex ?? inferRoundIndex(db, input.conversationId);

      db.prepare(
        `insert into messages (
          id, conversation_id, sender_type, sender_id, content, round_index, reply_to_message_id, meta_json, created_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        input.conversationId,
        input.senderType,
        input.senderId,
        input.content,
        roundIndex,
        input.replyToMessageId ?? null,
        JSON.stringify(input.meta ?? {}),
        createdAt
      );

      touchConversation(db, input.conversationId);

      return mapMessage(db.prepare("select * from messages where id = ?").get(id) as MessageRow);
    },

    listMessages(conversationId: string): Message[] {
      requireConversation(db, conversationId);
      const rows = db
        .prepare(
          `select * from messages
           where conversation_id = ?
           order by round_index asc, created_at asc, id asc`
        )
        .all(conversationId) as MessageRow[];

      return rows.map(mapMessage);
    }
  };
}
