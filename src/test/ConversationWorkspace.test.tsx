/**
 * [INPUT]: 依赖 React Testing Library、user-event 与对话控制器组合视图验证对话行为
 * [OUTPUT]: 对外提供对话主工作区的加入人物、单聊与群聊停止回归测试
 * [POS]: src/test 的对话工作台测试，约束前端对话骨架
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import type { ApiClient } from "../api/client";
import { ConversationSidePanel } from "../components/ConversationSidePanel";
import { ConversationWorkspace } from "../components/ConversationWorkspace";
import { useConversationController } from "../components/useConversationController";

const libraryPeople = [
  { id: "paul", name: "Paul Graham" },
  { id: "jensen", name: "黄仁勋" }
];

function ConversationHarness({ api, selectedPersonId = "paul" }: { api: ApiClient; selectedPersonId?: string }) {
  const conversation = useConversationController({
    api,
    libraryPeople,
    selectedPersonId
  });

  return (
    <div>
      <ConversationWorkspace
        directDisabled={conversation.directDisabled}
        disabled={conversation.isComposerDisabled}
        draft={conversation.draft}
        groupDisabled={conversation.groupDisabled}
        messages={conversation.messages}
        mode={conversation.mode}
        onChange={conversation.setDraft}
        onModeChange={conversation.setMode}
        onStop={() => void conversation.handleStop()}
        onSubmit={() => void conversation.handleSubmit()}
        runState={conversation.runState}
      />
      <ConversationSidePanel
        note={conversation.jobNote}
        onAdd={() => void conversation.handleAddParticipant()}
        onRemove={(participant) => void conversation.handleRemoveParticipant(participant)}
        onSelect={conversation.setSelectedAddPersonId}
        participants={conversation.participants}
        people={libraryPeople}
        selectedPersonId={conversation.selectedAddPersonId}
      />
    </div>
  );
}

describe("ConversationWorkspace", () => {
  test("adds a persona to the conversation and sends a direct message", async () => {
    let participants = [{ conversationId: "conv-1", personId: "paul", skillId: null, joinSource: "library", position: 0, isActive: true }];
    const api = {
      listPersonas: async () => ({ people: [] }),
      importNuwaPersonas: async () => ({ imported: [] }),
      deletePersona: async () => undefined,
      crawlSeedUrl: async () => ({ fragments: [] }),
      distillSkill: async () => ({}),
      evaluateProject: async () => ({}),
      createConversation: async () => ({ id: "conv-1", title: "数字高人对话", mode: "group" as const }),
      listConversationParticipants: async () => ({ participants }),
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
      getConversationRun: async () => ({ id: "run-2", conversationId: "conv-1", status: "completed" }),
      stopGroupRun: async () => undefined
    };

    render(<ConversationHarness api={api as ApiClient} />);

    await userEvent.clear(screen.getByLabelText("输入消息"));
    await userEvent.type(screen.getByLabelText("输入消息"), "你会投这个项目吗？");
    await userEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("Paul Graham", { selector: "strong" })).toBeInTheDocument();
    expect(await screen.findByText("先验证分发效率。")).toBeInTheDocument();
    expect(await screen.findByText("1 位")).toBeInTheDocument();
  });

  test("starts and stops group chat", async () => {
    let participants: Array<{ conversationId: string; personId: string; skillId: string | null; joinSource: string; position: number; isActive: boolean }> = [];
    let runStatus = "running";
    const api = {
      listPersonas: async () => ({ people: [] }),
      importNuwaPersonas: async () => ({ imported: [] }),
      deletePersona: async () => undefined,
      crawlSeedUrl: async () => ({ fragments: [] }),
      distillSkill: async () => ({}),
      evaluateProject: async () => ({}),
      createConversation: async () => ({ id: "conv-2", title: "数字高人对话", mode: "group" as const }),
      listConversationParticipants: async () => ({ participants }),
      addConversationParticipant: async (input: { personId: string; skillId?: string | null; joinSource: string }) => {
        participants = [
          ...participants,
          {
            conversationId: "conv-2",
            personId: input.personId,
            skillId: input.skillId ?? null,
            joinSource: input.joinSource,
            position: participants.length,
            isActive: true
          }
        ];
      },
      removeConversationParticipant: async () => undefined,
      sendConversationMessage: async () => ({ id: "msg-2", content: "来一轮群聊" }),
      listConversationMessages: async () => ({
        messages: [
          { id: "msg-2", senderType: "user", senderId: "user", content: "来一轮群聊" },
          { id: "msg-3", senderType: "persona", senderId: "paul", content: "先抓真实需求。" },
          { id: "msg-4", senderType: "persona", senderId: "jensen", content: "算力壁垒很关键。" },
          { id: "msg-5", senderType: "system", senderId: "system", content: "群聊已完成当前轮次。" }
        ]
      }),
      startDirectRun: async () => ({ id: "run-x" }),
      startGroupRun: async () => ({ id: "run-9" }),
      getConversationRun: async () => ({ id: "run-9", status: runStatus, conversationId: "conv-2" }),
      stopGroupRun: async () => {
        runStatus = "stopped";
      }
    };

    render(<ConversationHarness api={api as ApiClient} />);

    await userEvent.click(screen.getByRole("button", { name: "加入会话" }));
    await userEvent.selectOptions(screen.getByLabelText("添加人物"), "jensen");
    await userEvent.click(screen.getByRole("button", { name: "加入会话" }));
    await userEvent.click(screen.getByRole("button", { name: "群聊" }));
    await userEvent.click(screen.getByRole("button", { name: "发起群聊" }));
    expect(await screen.findByText(/群聊进行中/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "终止群聊" }));
    expect(await screen.findByText(/群聊已停止/i)).toBeInTheDocument();
    expect(screen.getByText("算力壁垒很关键。")).toBeInTheDocument();
  });
});
