/**
 * [INPUT]: 依赖 vitest 与 nuwaGatewayService 验证 README persona 解析契约
 * [OUTPUT]: 对外提供 nuwa README 归一化回归测试
 * [POS]: server/test 的 nuwa 网关测试，约束外部 README 到可导入 persona 结构的映射
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, test } from "vitest";
import { createNuwaGatewayService } from "../services/nuwaGatewayService.js";

describe("nuwaGatewayService", () => {
  test("normalizes nuwa persona list into importable library rows", async () => {
    const gateway = createNuwaGatewayService({
      fetchReadme: async () => `
## 已蒸馏人物
- Paul Graham
- 张一鸣
- Karpathy

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
      region: "未知",
      originRef: "nuwa-skill:paul-graham"
    });
    expect(personas.find((persona) => persona.name === "Karpathy")).toMatchObject({
      role: "ai_builder",
      region: "未知"
    });
    expect(personas.map((persona) => persona.name)).not.toContain("这不是人物");
  });
});
