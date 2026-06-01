/**
 * [INPUT]: 依赖浏览器 fetch 调用本地 /api 后端
 * [OUTPUT]: 对外提供 ApiClient 类型与 createApiClient 工厂
 * [POS]: src/api 的 HTTP seam，被 App 与工作区组件消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export type ApiClient = {
  crawlSeedUrl(input: { personId: string; url: string }): Promise<{ fragments: unknown[] }>;
  distillSkill(input: { personId: string }): Promise<unknown>;
  evaluateProject(input: { project: { title: string; brief: string }; personId: string; skillId: string }): Promise<unknown>;
};

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

export function createApiClient(): ApiClient {
  return {
    crawlSeedUrl(input) {
      return postJson("/api/research/crawl", input);
    },
    distillSkill(input) {
      return postJson("/api/skills/distill", input);
    },
    evaluateProject(input) {
      return postJson("/api/evaluations", input);
    }
  };
}
