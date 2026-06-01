/**
 * [INPUT]: 依赖 vitest、SQLite 迁移与 conversationService 验证会话、参与者、消息持久化
 * [OUTPUT]: 对外提供 conversationService 的参与者与消息回归测试
 * [POS]: server/test 的会话服务测试，约束 conversations/messages/conversation_participants 的最小闭环
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { openDatabase } from "../db/connection.js";
import { migrate } from "../db/migrate.js";
import { createConversationService } from "../services/conversationService.js";
import { createLibraryService } from "../services/libraryService.js";

function seedPersonWithSkill() {
  const dir = mkdtempSync(join(tmpdir(), "brainpower-conversation-service-"));
  const db = openDatabase(join(dir, "test.sqlite"));

  migrate(db);
  migrate(db);

  const library = createLibraryService(db);
  const person = library.createPerson({ name: "Paul Graham", role: "investor", region: "US", tags: ["essays"] });
  db.prepare(
    `insert into skills (
      id, person_id, version, mental_models_json, heuristics_json, voice_dna_json,
      anti_patterns_json, honesty_boundaries_json, citations_json, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run("skill-paul-v1", person.id, 1, "[]", "[]", "[]", "[]", "[]", "[]", "2026-06-01T00:00:00.000Z");

  return { dir, db, person };
}

describe("conversationService", () => {
  test("allows adding a participant before any skill has been distilled", () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-conversation-service-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      migrate(db);

      const library = createLibraryService(db);
      const person = library.createPerson({ name: "张一鸣", role: "entrepreneur", region: "CN", tags: ["product"] });
      const service = createConversationService(db);
      const conversation = service.createConversation({ title: "产品判断", mode: "group" });

      const participant = service.addParticipant({
        conversationId: conversation.id,
        personId: person.id,
        joinSource: "library"
      });

      expect(participant).toMatchObject({
        conversationId: conversation.id,
        personId: person.id,
        skillId: null,
        joinSource: "library",
        position: 0,
        isActive: true
      });
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("adds and removes participants from a conversation using optional skill snapshots", () => {
    const { dir, db, person } = seedPersonWithSkill();

    try {
      const service = createConversationService(db);
      const conversation = service.createConversation({ title: "创业判断", mode: "group" });

      const participant = service.addParticipant({
        conversationId: conversation.id,
        personId: person.id,
        joinSource: "library"
      });

      expect(participant).toMatchObject({
        conversationId: conversation.id,
        personId: person.id,
        skillId: "skill-paul-v1",
        joinSource: "library",
        position: 0,
        isActive: true
      });
      expect(service.listParticipants(conversation.id)).toHaveLength(1);

      service.removeParticipant(conversation.id, person.id);

      expect(service.listParticipants(conversation.id)).toEqual([]);
      expect(service.listConversations()).toHaveLength(1);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("stores messages and preserves reply metadata across reads", () => {
    const { dir, db } = seedPersonWithSkill();

    try {
      const service = createConversationService(db);
      const conversation = service.createConversation({ title: "产品讨论", mode: "direct" });
      const userMessage = service.createMessage({
        conversationId: conversation.id,
        senderType: "user",
        senderId: "user-local",
        content: "先讲结论。",
        meta: { channel: "manual" }
      });

      const reply = service.createMessage({
        conversationId: conversation.id,
        senderType: "system",
        senderId: "orchestrator",
        content: "收到，进入直接对话。",
        replyToMessageId: userMessage.id,
        meta: { mode: "direct" }
      });

      expect(service.listMessages(conversation.id)).toEqual([
        expect.objectContaining({
          id: userMessage.id,
          senderType: "user",
          replyToMessageId: null,
          meta: { channel: "manual" }
        }),
        expect.objectContaining({
          id: reply.id,
          senderType: "system",
          replyToMessageId: userMessage.id,
          roundIndex: userMessage.roundIndex,
          meta: { mode: "direct" }
        })
      ]);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("rejects reply targets from another conversation", () => {
    const { dir, db } = seedPersonWithSkill();

    try {
      const service = createConversationService(db);
      const conversationA = service.createConversation({ title: "A", mode: "direct" });
      const conversationB = service.createConversation({ title: "B", mode: "direct" });
      const foreignMessage = service.createMessage({
        conversationId: conversationA.id,
        senderType: "user",
        senderId: "user-a",
        content: "只属于 A"
      });

      expect(() =>
        service.createMessage({
          conversationId: conversationB.id,
          senderType: "system",
          senderId: "system",
          content: "错误引用",
          replyToMessageId: foreignMessage.id
        })
      ).toThrow("Reply target message must belong to the same conversation");
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
