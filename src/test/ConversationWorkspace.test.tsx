/**
 * [INPUT]: 依赖 React Testing Library、user-event 与 ConversationWorkspace 验证对话行为
 * [OUTPUT]: 对外提供 ConversationWorkspace 的加入人物、单聊与群聊停止回归测试
 * [POS]: src/test 的对话工作台测试，约束前端对话骨架
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { ConversationWorkspace } from "../components/ConversationWorkspace";

const libraryPeople = [
  { id: "paul", name: "Paul Graham" },
  { id: "jensen", name: "黄仁勋" }
];

describe("ConversationWorkspace", () => {
  test("adds a persona to the conversation and sends a direct message", async () => {
    const api = {
      listPersonas: async () => ({ people: [] }),
      importNuwaPersonas: async () => ({ imported: [] }),
      deletePersona: async () => undefined,
      crawlSeedUrl: async () => ({ fragments: [] }),
      distillSkill: async () => ({}),
      evaluateProject: async () => ({}),
      createConversation: async () => ({ id: "conv-1", title: "数字高人对话", mode: "group" as const }),
      addConversationParticipant: async () => ({}),
      removeConversationParticipant: async () => undefined,
      sendConversationMessage: async () => ({ id: "msg-1", content: "你会投这个项目吗？" }),
      listConversationMessages: async () => ({
        messages: [
          { id: "msg-1", senderType: "user", senderId: "user", content: "你会投这个项目吗？" },
          { id: "msg-2", senderType: "persona", senderId: "paul", content: "先验证分发效率。" }
        ]
      }),
      startDirectRun: async () => ({ id: "run-1" }),
      startGroupRun: async () => ({ id: "run-2" }),
      stopGroupRun: async () => undefined
    };

    render(<ConversationWorkspace api={api} libraryPeople={libraryPeople} selectedPersonId="paul" />);

    await userEvent.click(screen.getByRole("button", { name: "加入会话" }));
    await userEvent.clear(screen.getByLabelText("输入消息"));
    await userEvent.type(screen.getByLabelText("输入消息"), "你会投这个项目吗？");
    await userEvent.click(screen.getByRole("button", { name: "单聊" }));

    expect(await screen.findByText("Paul Graham", { selector: "strong" })).toBeInTheDocument();
    expect(await screen.findByText("先验证分发效率。")).toBeInTheDocument();
  });

  test("starts and stops group chat", async () => {
    const api = {
      listPersonas: async () => ({ people: [] }),
      importNuwaPersonas: async () => ({ imported: [] }),
      deletePersona: async () => undefined,
      crawlSeedUrl: async () => ({ fragments: [] }),
      distillSkill: async () => ({}),
      evaluateProject: async () => ({}),
      createConversation: async () => ({ id: "conv-2", title: "数字高人对话", mode: "group" as const }),
      addConversationParticipant: async () => ({}),
      removeConversationParticipant: async () => undefined,
      sendConversationMessage: async () => ({ id: "msg-2", content: "来一轮群聊" }),
      listConversationMessages: async () => ({
        messages: [
          { id: "msg-2", senderType: "user", senderId: "user", content: "来一轮群聊" },
          { id: "msg-3", senderType: "persona", senderId: "paul", content: "先抓真实需求。" },
          { id: "msg-4", senderType: "system", senderId: "system", content: "群聊已完成当前轮次。" }
        ]
      }),
      startDirectRun: async () => ({ id: "run-x" }),
      startGroupRun: async () => ({ id: "run-9" }),
      stopGroupRun: async () => undefined
    };

    render(<ConversationWorkspace api={api} libraryPeople={libraryPeople} selectedPersonId="paul" />);

    await userEvent.click(screen.getByRole("button", { name: "加入会话" }));
    await userEvent.click(screen.getByRole("button", { name: "群聊" }));
    expect(screen.getByText(/群聊进行中/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "终止群聊" }));
    expect(screen.getByText(/群聊已停止/i)).toBeInTheDocument();
  });
});
