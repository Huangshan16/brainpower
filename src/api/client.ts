/**
 * [INPUT]: 依赖浏览器 fetch 调用本地 /api 后端，依赖 shared Persona 类型约束人物库响应
 * [OUTPUT]: 对外提供 ApiClient 类型与 createApiClient 工厂，覆盖人物库与对话轮询 seam
 * [POS]: src/api 的 HTTP seam，被 App 与工作区组件消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { Persona } from "../../shared/schemas";

export type ApiClient = {
  listPersonas(): Promise<{ people: Persona[] }>;
  importNuwaPersonas(): Promise<{ imported: Persona[] }>;
  deletePersona(input: { personId: string }): Promise<void>;
  crawlSeedUrl(input: { personId: string; url: string }): Promise<{ fragments: unknown[] }>;
  distillSkill(input: { personId: string }): Promise<unknown>;
  evaluateProject(input: { project: { title: string; brief: string }; personId: string; skillId: string }): Promise<unknown>;
  createConversation(input: { title: string; mode: "direct" | "group" }): Promise<{ id: string; title: string; mode: "direct" | "group" }>;
  listConversationParticipants(input: {
    conversationId: string;
  }): Promise<{ participants: Array<{ conversationId: string; personId: string; skillId: string; joinSource: string; position: number; isActive: boolean }> }>;
  addConversationParticipant(input: {
    conversationId: string;
    personId: string;
    skillId: string;
    joinSource: string;
  }): Promise<unknown>;
  removeConversationParticipant(input: { conversationId: string; personId: string; skillId: string }): Promise<void>;
  sendConversationMessage(input: {
    conversationId: string;
    content: string;
    senderType?: "user" | "persona" | "system";
    senderId?: string;
    replyToMessageId?: string | null;
  }): Promise<{ id: string; content: string }>;
  listConversationMessages(input: { conversationId: string }): Promise<{ messages: Array<Record<string, unknown>> }>;
  startDirectRun(input: { conversationId: string; messageId: string; speakerPersonId: string }): Promise<Record<string, unknown>>;
  startGroupRun(input: { conversationId: string; messageId: string }): Promise<Record<string, unknown>>;
  getConversationRun(input: { conversationId: string; runId: string }): Promise<Record<string, unknown>>;
  stopGroupRun(input: { conversationId: string; runId: string }): Promise<void>;
};

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    try {
      const payload = (await response.json()) as { error?: string };

      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // Ignore non-JSON error bodies and keep the HTTP status message.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined;
  }

  return response.json();
}

async function getJson(path: string) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function deleteRequest(path: string) {
  const response = await fetch(path, { method: "DELETE" });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
}

export function createApiClient(): ApiClient {
  return {
    listPersonas() {
      return getJson("/api/personas");
    },
    importNuwaPersonas() {
      return postJson("/api/personas/import/nuwa", {});
    },
    deletePersona(input) {
      return deleteRequest(`/api/personas/${input.personId}`);
    },
    crawlSeedUrl(input) {
      return postJson("/api/research/crawl", input);
    },
    distillSkill(input) {
      return postJson("/api/skills/distill", input);
    },
    evaluateProject(input) {
      return postJson("/api/evaluations", input);
    },
    createConversation(input) {
      return postJson("/api/conversations", input);
    },
    listConversationParticipants(input) {
      return getJson(`/api/conversations/${input.conversationId}/participants`);
    },
    addConversationParticipant(input) {
      return postJson(`/api/conversations/${input.conversationId}/participants`, {
        personId: input.personId,
        skillId: input.skillId,
        joinSource: input.joinSource
      });
    },
    removeConversationParticipant(input) {
      return deleteRequest(`/api/conversations/${input.conversationId}/participants/${input.personId}/${input.skillId}`);
    },
    sendConversationMessage(input) {
      return postJson(`/api/conversations/${input.conversationId}/messages`, {
        content: input.content,
        senderType: input.senderType,
        senderId: input.senderId,
        replyToMessageId: input.replyToMessageId
      });
    },
    listConversationMessages(input) {
      return getJson(`/api/conversations/${input.conversationId}/messages`);
    },
    startDirectRun(input) {
      return postJson(`/api/conversations/${input.conversationId}/run/direct`, {
        messageId: input.messageId,
        speakerPersonId: input.speakerPersonId
      });
    },
    startGroupRun(input) {
      return postJson(`/api/conversations/${input.conversationId}/run/group`, {
        messageId: input.messageId
      });
    },
    getConversationRun(input) {
      return getJson(`/api/conversations/${input.conversationId}/runs/${input.runId}`);
    },
    async stopGroupRun(input) {
      await postJson(`/api/conversations/${input.conversationId}/run/stop`, { runId: input.runId });
    }
  };
}
