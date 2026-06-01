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
import type { ApiClient } from "../api/client";
import type { Persona } from "../../shared/schemas";

function buildPersona(overrides: Partial<Persona> = {}): Persona {
  return {
    id: "paul",
    name: "Paul Graham",
    role: "entrepreneur",
    region: "美国",
    status: "ready_to_evaluate",
    tags: ["创业", "写作", "产品"],
    originType: "nuwa_import",
    originRef: "nuwa-skill:paul-graham",
    personaKind: "person",
    isArchived: false,
    isDeleted: false,
    ...overrides
  };
}

function createApiMock(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    listPersonas: async () => ({
      people: [buildPersona()]
    }),
    importNuwaPersonas: async () => ({ imported: [] }),
    deletePersona: async () => undefined,
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
    stopGroupRun: async () => undefined,
    ...overrides
  };
}

describe("App", () => {
  test("renders the three-panel matrix workstation and switches workflows in Chinese", async () => {
    render(<App api={createApiMock()} />);

    expect(screen.getByRole("heading", { name: /数字高人矩阵/i })).toBeInTheDocument();
    expect(screen.getByLabelText("人物矩阵")).toBeInTheDocument();
    expect(screen.getByLabelText("工作区")).toBeInTheDocument();
    expect(screen.getByLabelText("证据与输出")).toBeInTheDocument();
    expect(await screen.findByText("Paul Graham", { selector: "strong" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "蒸馏" }));
    expect(screen.getByText(/技能蒸馏工作台/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "对话" }));
    expect(screen.getByRole("heading", { name: "对话工作台", level: 3 })).toBeInTheDocument();
  });

  test("submits a crawl request through the API client seam", async () => {
    const calls: Array<{ personId: string; url: string }> = [];

    render(<App api={createApiMock({
      crawlSeedUrl: async (input: { personId: string; url: string }) => {
        calls.push(input);
        return { fragments: [] };
      }
    })} />);

    await screen.findByText("Paul Graham", { selector: "strong" });
    await userEvent.type(screen.getByLabelText("种子链接"), "https://example.com/interview");
    await userEvent.click(screen.getByRole("button", { name: "开始采集" }));

    expect(calls[0].url).toBe("https://example.com/interview");
  });

  test("switches into conversation mode and exposes the conversation controls", async () => {
    const view = render(<App api={createApiMock()} />);

    const workflowTabs = within(view.container).getByRole("tablist", { name: "工作流切换" });

    await userEvent.click(within(workflowTabs).getByRole("button", { name: /^对话$/ }));

    expect(within(view.container).getByRole("button", { name: "发送" })).toBeInTheDocument();
    expect(within(view.container).getByRole("button", { name: "单聊" })).toBeInTheDocument();
    expect(within(view.container).getByRole("button", { name: "群聊" })).toBeInTheDocument();
  });

  test("switches the evidence panel person from the dropdown", async () => {
    render(
      <App
        api={createApiMock({
          listPersonas: async () => ({
            people: [buildPersona(), buildPersona({ id: "huang", name: "黄仁勋", role: "ai_builder", tags: ["算力"] })]
          })
        })}
      />
    );

    await screen.findByText("Paul Graham", { selector: "strong" });
    const selector = screen.getByLabelText("右侧人物切换");
    await userEvent.selectOptions(selector, "huang");

    expect(screen.getByRole("heading", { name: "黄仁勋", level: 2 })).toBeInTheDocument();
  });

  test("imports nuwa personas into the matrix", async () => {
    render(
      <App
        api={createApiMock({
          listPersonas: async () => ({ people: [] }),
          importNuwaPersonas: async () => ({
            imported: [buildPersona({ tags: ["创业", "写作"] })]
          })
        })}
      />
    );

    await userEvent.click(await screen.findByRole("button", { name: "同步女娲人物" }));

    expect(await screen.findByText("Paul Graham", { selector: "strong" })).toBeInTheDocument();
  });

  test("deletes the selected persona from the matrix", async () => {
    render(<App api={createApiMock()} />);

    await screen.findByText("Paul Graham", { selector: "strong" });
    await userEvent.click(screen.getByRole("button", { name: "删除当前人物" }));

    expect(screen.queryByText("Paul Graham", { selector: "strong" })).not.toBeInTheDocument();
    expect(screen.getByText(/人物库还是空的/i)).toBeInTheDocument();
  });
});
