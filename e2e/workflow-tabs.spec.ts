/**
 * [INPUT]: 依赖 @playwright/test 的浏览器驱动与本地 Vite/Express dev server
 * [OUTPUT]: 对外提供工作流 tabs 的端到端点击录证测试
 * [POS]: e2e 的浏览器验收用例，补足单元测试之外的真实交互证据
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { expect, test } from "@playwright/test";

const workflowCases = [
  { name: "Research", evidence: /Evidence intake for Peter Thiel/i },
  { name: "Distill", evidence: /Citation-aware skill distillation/i },
  { name: "Evaluate", evidence: /Project brief/i }
] as const;

test("clicks every workflow tab and captures browser evidence", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Digital High-Mind Matrix/i })).toBeVisible();
  const workflowTabs = page.getByRole("tablist", { name: "Workflow tabs" });

  for (const workflow of workflowCases) {
    await workflowTabs.getByRole("button", { name: workflow.name, exact: true }).click();
    await expect(workflowTabs.getByRole("button", { name: workflow.name, exact: true })).toBeVisible();
    await expect(page.getByText(workflow.evidence)).toBeVisible();

    await testInfo.attach(`${workflow.name.toLowerCase()}-view`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png"
    });
  }
});
