/**
 * [INPUT]: 依赖 @playwright/test 的浏览器驱动与本地 Vite/Express dev server
 * [OUTPUT]: 对外提供工作流 tabs 的端到端点击录证测试
 * [POS]: e2e 的浏览器验收用例，补足单元测试之外的真实交互证据
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { expect, test } from "@playwright/test";

const workflowCases = [
  { name: "研究", evidence: /黄仁勋的证据采集/i },
  { name: "蒸馏", evidence: /技能蒸馏工作台/i },
  { name: "评审", evidence: /项目简介/i }
] as const;

test("clicks every workflow tab and captures browser evidence", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /数字高人矩阵/i })).toBeVisible();
  const workflowTabs = page.getByRole("tablist", { name: "Workflow tabs" });
  const evidenceSelector = page.getByLabel("右侧人物切换");

  await expect(evidenceSelector).toBeVisible();
  await evidenceSelector.selectOption("huang");
  await expect(page.getByRole("heading", { name: "黄仁勋", level: 2 })).toBeVisible();

  const viewportFits = await page.evaluate(() => {
    const root = document.scrollingElement;

    return root ? root.scrollHeight - root.clientHeight : Number.POSITIVE_INFINITY;
  });

  expect(viewportFits).toBeLessThanOrEqual(4);

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
