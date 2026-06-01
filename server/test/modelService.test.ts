/**
 * [INPUT]: 依赖 vitest 与 modelService 验证 OpenAI 兼容 chat/completions 请求构造
 * [OUTPUT]: 对外提供模型服务 JSON 完成接口测试
 * [POS]: server/test 的模型服务测试，约束 provider 调用契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, test } from "vitest";
import { createModelService } from "../services/modelService.js";

describe("modelService", () => {
  test("sends OpenAI-compatible chat requests and returns text", async () => {
    const requests: unknown[] = [];
    const fetchJson = async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(init.body as string));
      return { choices: [{ message: { content: "{\"verdict\":\"pass\"}" } }] };
    };
    const model = createModelService({
      baseUrl: "https://models.example/v1",
      apiKey: "secret",
      modelName: "test-model",
      fetchJson
    });

    const text = await model.completeJson("system", "user");

    expect(text).toBe("{\"verdict\":\"pass\"}");
    expect(requests).toHaveLength(1);
  });

  test("strips fenced markdown wrappers from model JSON responses", async () => {
    const model = createModelService({
      baseUrl: "https://models.example/v1",
      apiKey: "secret",
      modelName: "test-model",
      fetchJson: async () => ({
        choices: [{ message: { content: "```json\n{\"verdict\":\"invest\"}\n```" } }]
      })
    });

    const text = await model.completeJson("system", "user");

    expect(text).toBe("{\"verdict\":\"invest\"}");
  });

  test("fails with a clear timeout error when provider does not respond in time", async () => {
    const model = createModelService({
      baseUrl: "https://models.example/v1",
      apiKey: "secret",
      modelName: "test-model",
      timeoutMs: 10,
      fetchJson: async () => new Promise(() => {})
    });

    await expect(model.completeJson("system", "user")).rejects.toThrow(/timed out after 10ms/i);
  });
});
