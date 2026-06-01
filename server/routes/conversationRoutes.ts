/**
 * [INPUT]: 依赖 express、zod、conversationService 与 conversationRunService 处理会话 HTTP 请求
 * [OUTPUT]: 对外提供 createConversationRoutes 路由工厂
 * [POS]: server/routes 的对话 HTTP 边界，被 app 装配到 /api
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Router } from "express";
import { z } from "zod";
import type { createConversationService } from "../services/conversationService.js";
import type { createConversationRunService } from "../services/conversationRunService.js";

type ConversationService = ReturnType<typeof createConversationService>;
type ConversationRunService = ReturnType<typeof createConversationRunService>;

const CreateConversationInputSchema = z.object({
  title: z.string().min(1),
  mode: z.enum(["direct", "group"])
});

const AddParticipantInputSchema = z.object({
  personId: z.string().min(1),
  skillId: z.string().min(1),
  joinSource: z.string().min(1),
  position: z.number().int().nonnegative().optional()
});

const CreateMessageInputSchema = z.object({
  content: z.string().min(1),
  senderType: z.enum(["user", "persona", "system"]).optional(),
  senderId: z.string().min(1).optional(),
  replyToMessageId: z.string().min(1).nullable().optional(),
  meta: z.record(z.unknown()).optional()
});

const DirectRunInputSchema = z.object({
  messageId: z.string().min(1),
  speakerPersonId: z.string().min(1)
});

const GroupRunInputSchema = z.object({
  messageId: z.string().min(1)
});

const StopRunInputSchema = z.object({
  runId: z.string().min(1),
  reason: z.string().min(1).optional()
});

export function createConversationRoutes(conversations: ConversationService, runs: ConversationRunService) {
  const router = Router();

  router.get("/conversations", (_req, res) => {
    res.json({ conversations: conversations.listConversations() });
  });

  router.post("/conversations", (req, res) => {
    const input = CreateConversationInputSchema.safeParse(req.body);

    if (!input.success) {
      res.status(400).json({ error: "Invalid conversation payload" });
      return;
    }

    res.status(201).json(conversations.createConversation(input.data));
  });

  router.get("/conversations/:conversationId/runs/:runId", (req, res) => {
    const run = runs.getRun(req.params.runId);

    if (!run || run.conversationId !== req.params.conversationId) {
      res.status(404).json({ error: "Conversation run not found" });
      return;
    }

    res.json(run);
  });

  router.get("/conversations/:conversationId/participants", (req, res) => {
    res.json({ participants: conversations.listParticipants(req.params.conversationId) });
  });

  router.post("/conversations/:conversationId/participants", (req, res) => {
    const input = AddParticipantInputSchema.safeParse(req.body);

    if (!input.success) {
      res.status(400).json({ error: "Invalid conversation participant payload" });
      return;
    }

    try {
      res.status(201).json(
        conversations.addParticipant({
          conversationId: req.params.conversationId,
          ...input.data
        })
      );
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to add participant" });
    }
  });

  router.delete("/conversations/:conversationId/participants/:personId/:skillId", (req, res) => {
    try {
      conversations.removeParticipant(req.params.conversationId, req.params.personId, req.params.skillId);
      res.status(204).send();
    } catch {
      res.status(404).json({ error: "Conversation participant not found" });
    }
  });

  router.get("/conversations/:conversationId/messages", (req, res) => {
    res.json({ messages: conversations.listMessages(req.params.conversationId) });
  });

  router.post("/conversations/:conversationId/messages", (req, res) => {
    const input = CreateMessageInputSchema.safeParse(req.body);

    if (!input.success) {
      res.status(400).json({ error: "Invalid conversation message payload" });
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
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create message" });
    }
  });

  router.post("/conversations/:conversationId/run/direct", async (req, res) => {
    const input = DirectRunInputSchema.safeParse(req.body);

    if (!input.success) {
      res.status(400).json({ error: "Invalid direct run payload" });
      return;
    }

    try {
      res.status(202).json(await runs.startDirectRun({ conversationId: req.params.conversationId, ...input.data }));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to start direct run" });
    }
  });

  router.post("/conversations/:conversationId/run/group", async (req, res) => {
    const input = GroupRunInputSchema.safeParse(req.body);

    if (!input.success) {
      res.status(400).json({ error: "Invalid group run payload" });
      return;
    }

    try {
      res.status(202).json(await runs.startGroupRun({ conversationId: req.params.conversationId, ...input.data }));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to start group run" });
    }
  });

  router.post("/conversations/:conversationId/run/stop", (req, res) => {
    const input = StopRunInputSchema.safeParse(req.body);

    if (!input.success) {
      res.status(400).json({ error: "Invalid stop run payload" });
      return;
    }

    try {
      runs.stopRun(input.data.runId, input.data.reason ?? "user_stop", req.params.conversationId);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : "Conversation run not found" });
    }
  });

  return router;
}
