/**
 * [INPUT]: 依赖 @playwright/test、浏览器路由拦截与本地 dev server 驱动完整对话流
 * [OUTPUT]: 对外提供人物加入、单聊、群聊、终止群聊的浏览器录证测试
 * [POS]: e2e 的对话主流程用例，证明前端聊天工作台可以逐步点击跑通
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

test("records a full browser conversation workflow", async ({ page }, testInfo) => {
  const messages: Array<{ id: string; senderType: string; senderId: string; content: string }> = [];
  let participants: Array<{ conversationId: string; personId: string; skillId: string | null; joinSource: string; position: number; isActive: boolean }> = [];
  let nextMessageId = 1;
  let runStatus = "completed";

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === "GET" && path === "/api/personas") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ people: personas })
      });
      return;
    }

    if (method === "POST" && path === "/api/conversations") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "conv-1", title: "数字高人对话", mode: "group" })
      });
      return;
    }

    if (method === "POST" && path === "/api/conversations/conv-1/participants") {
      const payload = JSON.parse(request.postData() ?? "{}") as { personId: string; skillId?: string | null; joinSource: string };
      participants = [
        ...participants,
        {
          conversationId: "conv-1",
          personId: payload.personId,
          skillId: payload.skillId,
          joinSource: payload.joinSource,
          position: participants.length,
          isActive: true
        }
      ];
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      return;
    }

    if (method === "GET" && path === "/api/conversations/conv-1/participants") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ participants })
      });
      return;
    }

    if (method === "DELETE" && path.startsWith("/api/conversations/conv-1/participants/")) {
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    if (method === "POST" && path === "/api/conversations/conv-1/messages") {
      const payload = JSON.parse(request.postData() ?? "{}") as { content?: string; senderType?: string; senderId?: string };
      const message = {
        id: `msg-${nextMessageId++}`,
        senderType: payload.senderType ?? "user",
        senderId: payload.senderId ?? "user",
        content: payload.content ?? ""
      };

      messages.push(message);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: message.id, content: message.content })
      });
      return;
    }

    if (method === "GET" && path === "/api/conversations/conv-1/messages") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          messages: messages.map((message, index) => ({
            ...message,
            conversationId: "conv-1",
            roundIndex: index,
            replyToMessageId: null,
            meta: {},
            createdAt: new Date(2026, 5, 1, 0, 0, index).toISOString()
          }))
        })
      });
      return;
    }

    if (method === "POST" && path === "/api/conversations/conv-1/run/direct") {
      runStatus = "completed";
      messages.push({
        id: `msg-${nextMessageId++}`,
        senderType: "persona",
        senderId: "paul",
        content: "先验证分发效率。"
      });

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "run-direct-1" })
      });
      return;
    }

    if (method === "POST" && path === "/api/conversations/conv-1/run/group") {
      runStatus = "running";
      messages.push(
        {
          id: `msg-${nextMessageId++}`,
          senderType: "persona",
          senderId: "paul",
          content: "先抓住最强用户，再谈扩张。"
        },
        {
          id: `msg-${nextMessageId++}`,
          senderType: "persona",
          senderId: "huang",
          content: "如果没有算力护城河，这个项目会很快同质化。"
        },
        {
          id: `msg-${nextMessageId++}`,
          senderType: "system",
          senderId: "system",
          content: "群聊已完成第 1 轮，准备进入下一轮。"
        }
      );

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "run-group-1" })
      });
      return;
    }

    if (method === "GET" && path === "/api/conversations/conv-1/runs/run-group-1") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "run-group-1", conversationId: "conv-1", status: runStatus })
      });
      return;
    }

    if (method === "POST" && path === "/api/conversations/conv-1/run/stop") {
      runStatus = "stopped";
      messages.push({
        id: `msg-${nextMessageId++}`,
        senderType: "system",
        senderId: "system",
        content: "群聊已终止。"
      });
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.fallback();
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: /Paul Graham/ })).toBeVisible();

  await page.getByRole("button", { name: "对话" }).click();
  await expect(page.getByRole("heading", { name: "对话工作台", level: 3 })).toBeVisible();

  await page.getByRole("button", { name: "加入会话" }).click();
  await page.getByLabel("添加人物").selectOption("huang");
  await page.getByRole("button", { name: "加入会话" }).click();
  await expect(page.getByText("2 位")).toBeVisible();

  await page.getByLabel("输入消息").fill("你会投这个项目吗？");
  await page.getByRole("button", { name: "单聊" }).click();
  await expect(page.getByText("单聊模式")).toBeVisible();
  await expect(page.getByText("先验证分发效率。")).toBeVisible();

  await testInfo.attach("direct-chat", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });

  await page.getByLabel("输入消息").fill("来一轮群聊。");
  await page.getByRole("button", { name: "群聊", exact: true }).click();
  await expect(page.getByText("群聊进行中")).toBeVisible();
  await expect(page.getByText("先抓住最强用户，再谈扩张。")).toBeVisible();
  await expect(page.getByText("如果没有算力护城河，这个项目会很快同质化。")).toBeVisible();

  await testInfo.attach("group-chat-running", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });

  await page.getByRole("button", { name: "终止群聊" }).click();
  await expect(page.getByText("群聊已停止")).toBeVisible();

  await testInfo.attach("group-chat-stopped", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });
});
