/**
 * [INPUT]: 依赖 OpenAI 兼容 chat/completions HTTP 接口与可注入 fetchJson 执行模型调用
 * [OUTPUT]: 对外提供 createModelService 工厂与 completeJson 方法
 * [POS]: server/services 的模型接入边界，被 skill/evaluation 服务消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { createLogger, type LogDetails, type Logger } from "../logger.js";

type FetchJson = (url: string, init: RequestInit) => Promise<{
  choices?: Array<{ message?: { content?: string | null } }>;
}>;

type ModelServiceOptions = {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  timeoutMs?: number;
  fetchJson?: FetchJson;
  logger?: Logger;
};

function normalizeJsonEnvelope(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return fenced ? fenced[1].trim() : trimmed;
}

const defaultFetchJson: FetchJson = async (url, init) => {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Model request failed with status ${response.status}`);
  }

  return (await response.json()) as Awaited<ReturnType<FetchJson>>;
};

export function createModelService({
  baseUrl,
  apiKey,
  modelName,
  timeoutMs = 30_000,
  fetchJson = defaultFetchJson,
  logger = createLogger("modelService")
}: ModelServiceOptions) {
  return {
    async completeJson(systemPrompt: string, userPrompt: string, context: LogDetails = {}) {
      const payload = {
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      };

      logger.info("model_request_started", {
        ...context,
        baseUrl,
        modelName,
        timeoutMs,
        systemPromptPreview: systemPrompt,
        userPromptPreview: userPrompt
      });

      try {
        const result = await Promise.race([
          fetchJson(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              authorization: `Bearer ${apiKey}`,
              "content-type": "application/json"
            },
            body: JSON.stringify(payload)
          }),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Model request timed out after ${timeoutMs}ms`)), timeoutMs);
          })
        ]);

        const content = result.choices?.[0]?.message?.content;

        if (!content) {
          logger.error("model_response_missing_content", context);
          throw new Error("Model response did not contain message content");
        }

        const normalized = normalizeJsonEnvelope(content);

        logger.info("model_request_succeeded", {
          ...context,
          rawContentPreview: content,
          normalizedPreview: normalized
        });

        return normalized;
      } catch (error) {
        logger.error("model_request_failed", {
          ...context,
          message: error instanceof Error ? error.message : "Unknown model error"
        });
        throw error;
      }
    }
  };
}
