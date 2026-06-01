/**
 * [INPUT]: 依赖 React Testing Library、user-event 与 App 组件验证三面板工作台切换
 * [OUTPUT]: 对外提供前端工作台布局与 workflow 切换回归测试
 * [POS]: src/test 的 App 测试，约束前端主界面骨架
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { App } from "../App";

describe("App", () => {
  test("renders the three-panel matrix workstation and switches workflows in Chinese", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /数字高人矩阵/i })).toBeInTheDocument();
    expect(screen.getByLabelText("人物矩阵")).toBeInTheDocument();
    expect(screen.getByLabelText("工作区")).toBeInTheDocument();
    expect(screen.getByLabelText("证据与输出")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "蒸馏" }));
    expect(screen.getByText(/技能蒸馏工作台/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "对话" }));
    expect(screen.getByRole("heading", { name: "对话工作台", level: 3 })).toBeInTheDocument();
  });

  test("submits a crawl request through the API client seam", async () => {
    const calls: Array<{ personId: string; url: string }> = [];

    render(
      <App
        api={{
          crawlSeedUrl: async (input) => {
            calls.push(input);
            return { fragments: [] };
          },
          distillSkill: async () => ({}),
          evaluateProject: async () => ({}),
          createConversation: async () => ({ id: "conv-x", title: "数字高人对话", mode: "group" as const }),
          addConversationParticipant: async () => ({}),
          removeConversationParticipant: async () => undefined,
          sendConversationMessage: async () => ({ id: "msg-x", content: "test" }),
          listConversationMessages: async () => ({ messages: [] }),
          startDirectRun: async () => ({ id: "run-x" }),
          startGroupRun: async () => ({ id: "run-y" }),
          stopGroupRun: async () => undefined
        }}
      />
    );

    await userEvent.type(screen.getByLabelText("种子链接"), "https://example.com/interview");
    await userEvent.click(screen.getByRole("button", { name: "开始采集" }));

    expect(calls[0].url).toBe("https://example.com/interview");
  });

  test("switches into conversation mode and exposes the conversation controls", async () => {
    const view = render(
      <App
        api={{
          crawlSeedUrl: async () => ({ fragments: [] }),
          distillSkill: async () => ({}),
          evaluateProject: async () => ({}),
          createConversation: async () => ({ id: "conv-1", title: "数字高人对话", mode: "group" as const }),
          addConversationParticipant: async () => ({}),
          removeConversationParticipant: async () => undefined,
          sendConversationMessage: async () => ({ id: "msg-1", content: "test" }),
          listConversationMessages: async () => ({ messages: [] }),
          startDirectRun: async () => ({ id: "run-1" }),
          startGroupRun: async () => ({ id: "run-2" }),
          stopGroupRun: async () => undefined
        }}
      />
    );

    const workflowTabs = within(view.container).getByRole("tablist", { name: "工作流切换" });

    await userEvent.click(within(workflowTabs).getByRole("button", { name: /^对话$/ }));

    expect(within(view.container).getByRole("button", { name: "发送" })).toBeInTheDocument();
    expect(within(view.container).getByRole("button", { name: "单聊" })).toBeInTheDocument();
    expect(within(view.container).getByRole("button", { name: "群聊" })).toBeInTheDocument();
  });

  test("switches the evidence panel person from the dropdown", async () => {
    render(<App />);

    const selector = screen.getByLabelText("右侧人物切换");
    await userEvent.selectOptions(selector, "huang");

    expect(screen.getByRole("heading", { name: "黄仁勋", level: 2 })).toBeInTheDocument();
  });
});
