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
  test("renders the three-panel matrix workstation and switches workflows", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Digital High-Mind Matrix/i })).toBeInTheDocument();
    expect(screen.getByLabelText("People matrix")).toBeInTheDocument();
    expect(screen.getByLabelText("Workflow workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("Evidence and output")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Distill" }));
    expect(screen.getByText(/Citation-aware skill distillation/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Evaluate" }));
    expect(screen.getByText(/Project brief/i)).toBeInTheDocument();
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
          evaluateProject: async () => ({})
        }}
      />
    );

    await userEvent.type(screen.getByLabelText("Seed URL"), "https://example.com/interview");
    await userEvent.click(screen.getByRole("button", { name: "Start crawl" }));

    expect(calls[0].url).toBe("https://example.com/interview");
  });

  test("shows progress and failure feedback when evaluation request fails", async () => {
    let release = () => {};

    const view = render(
      <App
        api={{
          crawlSeedUrl: async () => ({ fragments: [] }),
          distillSkill: async () => ({}),
          evaluateProject: () =>
            new Promise((_, reject) => {
              release = () => reject(new Error("Model request failed with status 500"));
            })
        }}
      />
    );

    const workflowTabs = within(view.container).getByRole("tablist", { name: "Workflow tabs" });

    await userEvent.click(within(workflowTabs).getByRole("button", { name: /^Evaluate$/ }));
    await userEvent.click(within(view.container).getByRole("button", { name: "Run matrix" }));

    expect(within(view.container).getByText(/Running matrix evaluation/i)).toBeInTheDocument();

    release();

    expect(await within(view.container).findByText(/Model request failed with status 500/i)).toBeInTheDocument();
  });
});
