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

const ROLE_BY_NAME: Record<string, Persona["role"]> = {
  "paul graham": "entrepreneur",
  "张一鸣": "entrepreneur",
  karpathy: "ai_builder",
  "ilya sutskever": "ai_builder",
  "elon musk": "entrepreneur",
  "steve jobs": "entrepreneur",
  naval: "investor",
  munger: "investor",
  taleb: "investor",
  feynman: "ai_builder",
  trump: "entrepreneur",
  mrbeast: "entrepreneur"
};

const REGION_BY_NAME: Record<string, string> = {
  "paul graham": "美国",
  "张一鸣": "中国",
  karpathy: "美国",
  "ilya sutskever": "加拿大",
  "mrbeast": "美国",
  "特朗普": "美国",
  "steve jobs": "美国",
  "乔布斯": "美国",
  "elon musk": "美国",
  "马斯克": "美国",
  "munger": "美国",
  "芒格": "美国",
  "feynman": "美国",
  "费曼": "美国",
  "naval": "美国",
  "纳瓦尔": "美国",
  "taleb": "美国",
  "塔勒布": "美国"
};

function defaultFetchReadme() {
  return fetch(DEFAULT_README_URL).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch nuwa-skill README: ${response.status}`);
    }

    return response.text();
  });
}

function normalizePersonaName(raw: string) {
  return raw
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/[⭐🔥]/g, "")
    .trim();
}

function parseDomainTags(raw: string) {
  return raw
    .split(/[\/、，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function parsePersonaRows(readme: string) {
  const distilledSection = readme.match(/## 已蒸馏人物([\s\S]*?)(?:\n## |\n# |$)/)?.[1] ?? "";
  const peopleSection = distilledSection.match(/### 人物Skill([\s\S]*?)(?:\n### |\n## |\n# |$)/)?.[1] ?? distilledSection;
  const tableRows = peopleSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && !line.includes("|------"));

  if (tableRows.length > 0) {
    return tableRows
      .map((line) => line.split("|").map((cell) => cell.trim()).filter(Boolean))
      .filter((cells) => cells.length >= 2 && cells[0] !== "人物")
      .map((cells) => ({
        name: normalizePersonaName(cells[0]),
        tags: parseDomainTags(cells[1])
      }))
      .filter((persona) => persona.name.length > 0);
  }

  return peopleSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => ({ name: normalizePersonaName(line.replace(/^- /, "")), tags: ["nuwa-import"] }))
    .filter((persona) => persona.name.length > 0);
}

function inferRole(name: string): Persona["role"] {
  return ROLE_BY_NAME[name.trim().toLowerCase()] ?? "entrepreneur";
}

function inferRegion(name: string) {
  return REGION_BY_NAME[name.trim().toLowerCase()] ?? "未知";
}

function toOriginRef(name: string) {
  return `nuwa-skill:${name.trim().toLowerCase().replaceAll(/\s+/g, "-")}`;
}

export function createNuwaGatewayService(options: NuwaGatewayOptions = {}) {
  const fetchReadme = options.fetchReadme ?? defaultFetchReadme;

  return {
    async listImportedPersonas(): Promise<ImportedPersona[]> {
      const rows = parsePersonaRows(await fetchReadme());

      return rows.map((row) => ({
        name: row.name,
        role: inferRole(row.name),
        region: inferRegion(row.name),
        tags: row.tags.length > 0 ? row.tags : ["nuwa-import"],
        originType: "nuwa_import",
        originRef: toOriginRef(row.name)
      }));
    }
  };
}
