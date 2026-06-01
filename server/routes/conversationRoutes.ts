/**
 * [INPUT]: 依赖 express Router、zod 输入验证、conversationService 与 conversationRunService
 * [OUTPUT]: 对外提供 createConversationRoutes 路由工厂
 * [POS]: server/routes 的会话 HTTP 边界，被 app 装配到 /api 并把 run 控制维持在薄路由
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Router } from "express";
import { z } from "zod";
import type { createConversationRunService } from "../services/conversationRunService.js";
import type { createConversationService } from "../services/conversationService.js";

type ConversationService = ReturnType<typeof createConversationService>;
type ConversationRunService = ReturnType<typeof createConversationRunService>;

const CreateConversationSchema = z.object({
  title: z.string().min(1),
  mode: z.enum(["direct", "group"])
});

const AddParticipantSchema = z.object({
  personId: z.string().min(1),
  skillId: z.string().min(1),
  joinSource: z.string().min(1)
});

const CreateMessageSchema = z.object({
  senderType: z.enum(["user", "persona", "system"]),
  senderId: z.string().min(1),
  content: z.string().min(1),
  roundIndex: z.number().int().nonnegative().optional(),
  replyToMessageId: z.string().min(1).nullable().optional(),
  meta: z.record(z.any()).optional()
});

const StartDirectRunSchema = z.object({
  messageId: z.string().min(1),
  speakerPersonId: z.string().min(1)
});

const StartGroupRunSchema = z.object({
  messageId: z.string().min(1)
});

const StopRunSchema = z.object({
  runId: z.string().min(1),
  reason: z.string().min(1)
});

export function createConversationRoutes(conversations: ConversationService, runs: ConversationRunService) {
  const router = Router();

  router.get("/conversations", (_req, res) => {
    res.json(conversations.listConversations());
  });

  router.post("/conversations", (req, res) => {
    const input = CreateConversationSchema.safeParse(req.body);

    if (!input.success) {
      res.status(400).json({ error: "Invalid conversation payload" });
      return;
    }

    res.status(201).json(conversations.createConversation(input.data));
  });

  router.get("/conversations/:conversationId/participants", (req, res) => {
    try {
      res.json(conversations.listParticipants(req.params.conversationId));
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : "Conversation not found" });
    }
  });

  router.post("/conversations/:conversationId/participants", (req, res) => {
    const input = AddParticipantSchema.safeParse(req.body);

    if (!input.success) {
      res.status(400).json({ error: "Invalid participant payload" });
      return;
    }

    try {
      res.status(201).json(
        conversations.addParticipant({
          conversationId: req.params.conversationId,
          personId: input.data.personId,
          skillId: input.data.skillId,
          joinSource: input.data.joinSource
        })
      );
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to add participant" });
    }
  });

  router.delete("/conversations/:conversationId/participants/:personId/:skillId", (req, res) => {
    try {
      conversations.removeParticipant(req.params.conversationId, req.params.personId, req.params.skillId);
      res.status(204).end();
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : "Conversation not found" });
    }
  });

  router.get("/conversations/:conversationId/messages", (req, res) => {
    try {
      res.json(conversations.listMessages(req.params.conversationId));
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : "Conversation not found" });
    }
  });

  router.post("/conversations/:conversationId/messages", (req, res) => {
    const input = CreateMessageSchema.safeParse(req.body);

    if (!input.success) {
      res.status(400).json({ error: "Invalid message payload" });
      return;
    }

    try {
      res.status(201).json(
        conversations.createMessage({
          conversationId: req.params.conversationId,
          ...input.data
        })
      );
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create message" });
    }
  });

  router.post("/conversations/:conversationId/run/direct", async (req, res) => {
    const input = StartDirectRunSchema.safeParse(req.body);

    if (!input.success) {
      res.status(400).json({ error: "Invalid direct run payload" });
      return;
    }

    try {
      res.status(202).json(
        await runs.startDirectRun({
          conversationId: req.params.conversationId,
          messageId: input.data.messageId,
          speakerPersonId: input.data.speakerPersonId
        })
      );
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start direct run" });
    }
  });

  router.post("/conversations/:conversationId/run/group", async (req, res) => {
    const input = StartGroupRunSchema.safeParse(req.body);

    if (!input.success) {
      res.status(400).json({ error: "Invalid group run payload" });
      return;
    }

    try {
      res.status(202).json(
        await runs.startGroupRun({
          conversationId: req.params.conversationId,
          messageId: input.data.messageId
        })
      );
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start group run" });
    }
  });

  router.post("/conversations/:conversationId/run/stop", async (req, res) => {
    const input = StopRunSchema.safeParse(req.body);

    if (!input.success) {
      res.status(400).json({ error: "Invalid stop run payload" });
      return;
    }

    try {
      const run = runs.getRun(input.data.runId);

      if (run.conversationId !== req.params.conversationId) {
        res.status(404).json({ error: "Conversation run not found" });
        return;
      }

      res.json(await runs.stopRun(input.data.runId, input.data.reason));
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : "Conversation run not found" });
    }
  });

  router.get("/conversations/:conversationId/runs/:runId", (req, res) => {
    try {
      const run = runs.getRun(req.params.runId);

      if (run.conversationId !== req.params.conversationId) {
        res.status(404).json({ error: "Conversation run not found" });
        return;
      }

      res.json(run);
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : "Conversation run not found" });
    }
  });

  return router;
}
