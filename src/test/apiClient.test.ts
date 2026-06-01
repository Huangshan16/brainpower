/**
 * [INPUT]: 依赖 vitest、浏览器 fetch mock 与 api client 验证错误消息透传
 * [OUTPUT]: 对外提供前端 API client 错误处理测试
 * [POS]: src/test 的 seam 测试，约束浏览器请求失败时的可读错误反馈
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { createApiClient } from "../api/client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("apiClient", () => {
  test("surfaces backend error messages instead of a generic 500", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: "Model request timed out after 5000ms" }), {
        status: 500,
        headers: { "content-type": "application/json" }
      })
    ) as typeof fetch;

    const client = createApiClient();

    await expect(
      client.evaluateProject({
        project: { title: "t", brief: "b" },
        personId: "thiel",
        skillId: "thiel-v1"
      })
    ).rejects.toThrow(/timed out after 5000ms/i);
  });
});
