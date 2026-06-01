/**
 * [INPUT]: 依赖 fetchReadme seam 或全局 fetch 访问 nuwa-skill README，并解析已蒸馏人物列表
 * [OUTPUT]: 对外提供 createNuwaGatewayService 工厂与 listImportedPersonas 方法
 * [POS]: server/services 的外部网关适配层，被 personaRoutes 与后续 distillation 流程消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { type Persona } from "../../shared/schemas.js";

type ImportedPersona = Pick<Persona, "name" | "role" | "region" | "tags"> & {
  originType: Persona["originType"];
  originRef: string;
};

type NuwaGatewayOptions = {
  fetchReadme?: () => Promise<string>;
};

const DEFAULT_README_URL = "https://raw.githubusercontent.com/alchaincyf/nuwa-skill/main/README.md";

function defaultFetchReadme() {
  return fetch(DEFAULT_README_URL).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch nuwa-skill README: ${response.status}`);
    }

    return response.text();
  });
}

function parsePersonaNames(readme: string) {
  const section = readme.split("## 已蒸馏人物")[1] ?? "";

  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, "").trim())
    .filter(Boolean);
}

export function createNuwaGatewayService(options: NuwaGatewayOptions = {}) {
  const fetchReadme = options.fetchReadme ?? defaultFetchReadme;

  return {
    async listImportedPersonas(): Promise<ImportedPersona[]> {
      const names = parsePersonaNames(await fetchReadme());

      return names.map((name) => ({
        name,
        role: "ai_builder",
        region: "unknown",
        tags: ["nuwa-import"],
        originType: "nuwa_import",
        originRef: `nuwa-skill:${name}`
      }));
    }
  };
}
