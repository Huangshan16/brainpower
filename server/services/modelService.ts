/**
 * [INPUT]: 依赖 OpenAI 兼容 chat/completions HTTP 接口与可注入 fetchJson 执行模型调用
 * [OUTPUT]: 对外提供 createModelService 工厂与 completeJson 方法
 * [POS]: server/services 的模型接入边界，被 skill/evaluation 服务消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
type FetchJson = (url: string, init: RequestInit) => Promise<{
  choices?: Array<{ message?: { content?: string | null } }>;
}>;

type ModelServiceOptions = {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  fetchJson?: FetchJson;
};

const defaultFetchJson: FetchJson = async (url, init) => {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Model request failed with status ${response.status}`);
  }

  return (await response.json()) as Awaited<ReturnType<FetchJson>>;
};

export function createModelService({ baseUrl, apiKey, modelName, fetchJson = defaultFetchJson }: ModelServiceOptions) {
  return {
    async completeJson(systemPrompt: string, userPrompt: string) {
      const payload = {
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      };

      const result = await fetchJson(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const content = result.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("Model response did not contain message content");
      }

      return content;
    }
  };
}
