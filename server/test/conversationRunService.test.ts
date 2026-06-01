/**
 * [INPUT]: 依赖 vitest、SQLite、conversationService 与 conversationRunService 验证 run 生命周期
 * [OUTPUT]: 对外提供 conversationRunService 的 direct/group run 回归测试
 * [POS]: server/test 的会话运行测试，约束 group stop 不删除消息且 direct run 会生成回复
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { openDatabase } from "../db/connection.js";
import { migrate } from "../db/migrate.js";
import { createConversationRunService } from "../services/conversationRunService.js";
import { createConversationService } from "../services/conversationService.js";
import { createLibraryService } from "../services/libraryService.js";

function seedConversationFixture() {
  const dir = mkdtempSync(join(tmpdir(), "brainpower-conversation-run-"));
  const db = openDatabase(join(dir, "test.sqlite"));

  migrate(db);
  migrate(db);

  const library = createLibraryService(db);
  const conversations = createConversationService(db);
  const person = library.createPerson({ name: "Paul Graham", role: "investor", region: "US", tags: ["founders"] });
  db.prepare(
    `insert into skills (
      id, person_id, version, mental_models_json, heuristics_json, voice_dna_json,
      anti_patterns_json, honesty_boundaries_json, citations_json, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run("skill-paul-v1", person.id, 1, "[]", "[]", "[]", "[]", "[]", "[]", "2026-06-01T00:00:00.000Z");
  const conversation = conversations.createConversation({ title: "AI 创业", mode: "group" });
  conversations.addParticipant({
    conversationId: conversation.id,
    personId: person.id,
    skillId: "skill-paul-v1",
    joinSource: "manual"
  });
  const userMessage = conversations.createMessage({
    conversationId: conversation.id,
    senderType: "user",
    senderId: "user-local",
    content: "给我一句判断。"
  });

  return { dir, db, conversations, conversation, person, userMessage };
}

describe("conversationRunService", () => {
  test("stops an active group run without deleting messages", async () => {
    const { dir, db, conversations, conversation, userMessage } = seedConversationFixture();

    try {
      const runs = createConversationRunService({
        db,
        conversations,
        model: {
          completeJson: async () => JSON.stringify({ reply: "先别自嗨，先找 PMF。" })
        }
      });
      const run = await runs.startGroupRun({ conversationId: conversation.id, messageId: userMessage.id });

      expect(run.status).toBe("running");
      const messagesAfterStart = conversations.listMessages(conversation.id);
      expect(messagesAfterStart.map((message) => message.senderType)).toEqual(["user", "persona", "system"]);

      const stopped = await runs.stopRun(run.id, "user_stop");

      expect(stopped.status).toBe("stopped");
      expect(stopped.stopReason).toBe("user_stop");
      expect(runs.getRun(run.id)).toMatchObject({ id: run.id, status: "stopped" });
      expect(conversations.listMessages(conversation.id)).toHaveLength(messagesAfterStart.length);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("creates a direct reply run for a selected persona", async () => {
    const { dir, db, conversations, conversation, person, userMessage } = seedConversationFixture();

    try {
      const runs = createConversationRunService({
        db,
        conversations,
        model: {
          completeJson: async () => JSON.stringify({ reply: "只回答一句：现在还太早。" })
        }
      });
      const run = await runs.startDirectRun({
        conversationId: conversation.id,
        messageId: userMessage.id,
        speakerPersonId: person.id
      });

      expect(run.status).toBe("completed");
      expect(run.speakerPersonId).toBe(person.id);
      expect(conversations.listMessages(conversation.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            senderType: "persona",
            senderId: person.id,
            replyToMessageId: userMessage.id
          })
        ])
      );
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("rejects starting a run with a message from another conversation", async () => {
    const { dir, db, conversations, conversation, person, userMessage } = seedConversationFixture();

    try {
      const otherConversation = conversations.createConversation({ title: "别的会话", mode: "direct" });
      const runs = createConversationRunService({
        db,
        conversations,
        model: {
          completeJson: async () => JSON.stringify({ reply: "不会走到这里" })
        }
      });

      await expect(
        runs.startDirectRun({
          conversationId: otherConversation.id,
          messageId: userMessage.id,
          speakerPersonId: person.id
        })
      ).rejects.toThrow("Message must belong to the selected conversation");

      const validRun = await runs.startGroupRun({ conversationId: conversation.id, messageId: userMessage.id });

      expect(() => runs.stopRun(validRun.id, "user_stop", otherConversation.id)).toThrow(
        "Conversation run does not belong to the selected conversation"
      );
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
