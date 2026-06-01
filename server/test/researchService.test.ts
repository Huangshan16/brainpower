/**
 * [INPUT]: 依赖 vitest、server/db、libraryService 与 researchService 验证种子 URL 抓取与去重契约
 * [OUTPUT]: 对外提供 researchService 的正文抽取、去重与 job 状态回归测试
 * [POS]: server/test 的研究服务测试，约束采集管线的最小可运行闭环
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { openDatabase } from "../db/connection.js";
import { migrate } from "../db/migrate.js";
import { createLibraryService } from "../services/libraryService.js";
import { createResearchService } from "../services/researchService.js";

describe("researchService", () => {
  test("extracts readable text from a seed URL and dedupes repeated content", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-research-"));
    const db = openDatabase(join(dir, "test.sqlite"));

    try {
      migrate(db);
      const library = createLibraryService(db);
      const person = library.createPerson({ name: "徐新", role: "investor", region: "CN", tags: ["consumer"] });
      const html =
        "<html><head><title>Interview</title></head><body><main><h1>投资判断</h1><p>我首先看人，其次看赛道。</p></main></body></html>";
      const fetchPage = async () => ({ url: "https://example.com/xu", html });
      const service = createResearchService({ db, library, fetchPage });

      const first = await service.crawlSeedUrl({ personId: person.id, url: "https://example.com/xu" });
      const second = await service.crawlSeedUrl({ personId: person.id, url: "https://example.com/xu" });

      expect(first.fragments).toHaveLength(1);
      expect(second.fragments).toHaveLength(0);
      expect(library.listFragments(person.id)[0].content).toContain("我首先看人");

      const jobs = db.prepare("select type, status from jobs order by created_at asc").all() as Array<{
        type: string;
        status: string;
      }>;
      expect(jobs).toEqual([
        { type: "crawl", status: "succeeded" },
        { type: "crawl", status: "succeeded" }
      ]);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
