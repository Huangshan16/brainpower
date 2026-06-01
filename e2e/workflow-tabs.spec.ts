/**
 * [INPUT]: 依赖 @playwright/test 的浏览器驱动与本地 Vite/Express dev server
 * [OUTPUT]: 对外提供工作流 tabs 的端到端点击录证测试
 * [POS]: e2e 的浏览器验收用例，补足单元测试之外的真实交互证据
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { expect, test } from "@playwright/test";

const personas = [
  {
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
    isDeleted: false
  },
  {
    id: "huang",
    name: "黄仁勋",
    role: "ai_builder",
    region: "美国",
    status: "ready_to_evaluate",
    tags: ["算力", "平台"],
    originType: "nuwa_import",
    originRef: "nuwa-skill:huang-renxun",
    personaKind: "person",
    isArchived: false,
    isDeleted: false
  }
] as const;

const workflowCases = [
  { name: "研究", kind: "text", evidence: /黄仁勋的证据采集/i },
  { name: "蒸馏", kind: "text", evidence: /技能蒸馏工作台/i },
  { name: "对话", kind: "heading", evidence: /对话工作台/i }
] as const;

test("clicks every workflow tab and captures browser evidence", async ({ page }, testInfo) => {
  await page.route("**/api/personas", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ people: personas })
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /数字高人矩阵/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Paul Graham/ })).toBeVisible();
  const workflowTabs = page.getByRole("tablist", { name: "工作流切换" });
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
    if (workflow.kind === "heading") {
      await expect(page.getByRole("heading", { name: workflow.evidence, level: 3 })).toBeVisible();
    } else {
      await expect(page.getByText(workflow.evidence)).toBeVisible();
    }

    await testInfo.attach(`${workflow.name.toLowerCase()}-view`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png"
    });
  }
});
