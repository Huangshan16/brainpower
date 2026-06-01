/**
 * [INPUT]: 依赖 vitest 与 nuwaGatewayService 验证 README persona 解析契约
 * [OUTPUT]: 对外提供 nuwa README 归一化回归测试
 * [POS]: server/test 的 nuwa 网关测试，约束外部 README 到可导入 persona 结构的映射
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, test } from "vitest";
import { createNuwaGatewayService } from "../services/nuwaGatewayService.js";

describe("nuwaGatewayService", () => {
  test("normalizes nuwa persona table into importable library rows", async () => {
    const gateway = createNuwaGatewayService({
      fetchReadme: async () => `
## 已蒸馏人物

### 人物Skill

| 人物 | 领域 | 独立仓库 | 一键安装 |
|------|------|---------|---------|
| 🔥 **Paul Graham** | 创业/写作/产品/人生哲学 | [paul-graham-skill](https://github.com/alchaincyf/paul-graham-skill) | \`npx skills add alchaincyf/paul-graham-skill\` |
| 🔥 **张一鸣** | 产品/组织/全球化/人才 | [zhang-yiming-skill](https://github.com/alchaincyf/zhang-yiming-skill) | \`npx skills add alchaincyf/zhang-yiming-skill\` |
| 🔥 **Karpathy** | AI/工程/教育/开源 | [karpathy-skill](https://github.com/alchaincyf/karpathy-skill) | \`npx skills add alchaincyf/karpathy-skill\` |

### 主题Skill

| 主题 | 领域 | 独立仓库 | 一键安装 |
|------|------|---------|---------|
| **X导师** | X/Twitter运营全栈 | [x-mentor-skill](https://github.com/alchaincyf/x-mentor-skill) | \`npx skills add alchaincyf/x-mentor-skill\` |

## 工作原理
- 这不是人物
`
    });

    const personas = await gateway.listImportedPersonas();

    expect(personas.map((persona) => persona.name)).toEqual(expect.arrayContaining(["Paul Graham", "张一鸣", "Karpathy"]));
    expect(personas).toHaveLength(3);
    expect(personas.find((persona) => persona.name === "Paul Graham")).toMatchObject({
      role: "entrepreneur",
      originType: "nuwa_import",
      region: "美国",
      originRef: "nuwa-skill:paul-graham"
    });
    expect(personas.find((persona) => persona.name === "Karpathy")).toMatchObject({
      role: "ai_builder",
      region: "美国",
      tags: ["AI", "工程", "教育"]
    });
    expect(personas.find((persona) => persona.name === "张一鸣")).toMatchObject({
      region: "中国",
      tags: ["产品", "组织", "全球化"]
    });
    expect(personas.map((persona) => persona.name)).not.toContain("X导师");
  });
});
