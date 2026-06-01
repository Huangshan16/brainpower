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
    expect(screen.getByLabelText("People matrix")).toBeInTheDocument();
    expect(screen.getByLabelText("Workflow workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("Evidence and output")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "蒸馏" }));
    expect(screen.getByText(/技能蒸馏工作台/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "评审" }));
    expect(screen.getByText(/项目简介/i)).toBeInTheDocument();
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

    await userEvent.type(screen.getByLabelText("种子链接"), "https://example.com/interview");
    await userEvent.click(screen.getByRole("button", { name: "开始采集" }));

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

    await userEvent.click(within(workflowTabs).getByRole("button", { name: /^评审$/ }));
    await userEvent.click(within(view.container).getByRole("button", { name: "运行评审矩阵" }));

    expect(within(view.container).getByText(/正在运行评审矩阵/i)).toBeInTheDocument();

    release();

    expect(await within(view.container).findByText(/Model request failed with status 500/i)).toBeInTheDocument();
  });

  test("switches the evidence panel person from the dropdown", async () => {
    render(<App />);

    const selector = screen.getByLabelText("右侧人物切换");
    await userEvent.selectOptions(selector, "huang");

    expect(screen.getByRole("heading", { name: "黄仁勋", level: 2 })).toBeInTheDocument();
  });
});
