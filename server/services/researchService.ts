/**
 * [INPUT]: 依赖 better-sqlite3、cheerio、crypto 与 libraryService 执行种子 URL 采集、去重与 job 持久化
 * [OUTPUT]: 对外提供 createResearchService 工厂与 crawlSeedUrl 方法
 * [POS]: server/services 的研究采集边界，被 researchRoutes 与服务测试消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { load } from "cheerio";
import type { createLibraryService } from "./libraryService.js";

type LibraryService = ReturnType<typeof createLibraryService>;

type FetchPage = (url: string) => Promise<{
  url: string;
  html: string;
}>;

type CrawlSeedUrlInput = {
  personId: string;
  url: string;
};

type ResearchServiceOptions = {
  db: Database.Database;
  library: LibraryService;
  fetchPage: FetchPage;
};

function now() {
  return new Date().toISOString();
}

function extractReadableText(html: string) {
  const $ = load(html);
  const title = $("title").first().text().trim() || "Untitled source";
  const container = $("main").first().length ? $("main").first() : $("article").first().length ? $("article").first() : $("body").first();
  const content = container
    .find("h1, h2, h3, p, li, blockquote")
    .map((_, element) => $(element).text().trim())
    .get()
    .filter(Boolean)
    .join("\n")
    .trim();

  return {
    title,
    content: content || container.text().replace(/\s+/g, " ").trim()
  };
}

function createContentHash(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function createJob(db: Database.Database, personId: string, input: CrawlSeedUrlInput) {
  const id = crypto.randomUUID();
  const timestamp = now();

  db.prepare(
    `insert into jobs (id, type, status, person_id, input, output, error, created_at, updated_at)
     values (?, 'crawl', 'running', ?, ?, '[]', null, ?, ?)`
  ).run(id, personId, JSON.stringify([input.url]), timestamp, timestamp);

  return id;
}

function finishJob(db: Database.Database, jobId: string, status: "succeeded" | "failed", output: string[], error?: string) {
  db.prepare("update jobs set status = ?, output = ?, error = ?, updated_at = ? where id = ?").run(
    status,
    JSON.stringify(output),
    error ?? null,
    now(),
    jobId
  );
}

function getExistingSourceId(db: Database.Database, personId: string, url: string) {
  const row = db.prepare("select id from sources where person_id = ? and url = ?").get(personId, url) as { id: string } | undefined;
  return row?.id;
}

function hasExistingContentHash(db: Database.Database, personId: string, contentHash: string) {
  const rows = db.prepare("select content from fragments where person_id = ?").all(personId) as Array<{ content: string }>;
  return rows.some((row) => createContentHash(row.content) === contentHash);
}

export function createResearchService({ db, library, fetchPage }: ResearchServiceOptions) {
  return {
    async crawlSeedUrl({ personId, url }: CrawlSeedUrlInput) {
      const jobId = createJob(db, personId, { personId, url });

      try {
        const page = await fetchPage(url);
        const { title, content } = extractReadableText(page.html);
        const contentHash = createContentHash(content);
        const existingSourceId = getExistingSourceId(db, personId, page.url);
        const isDuplicate = existingSourceId || hasExistingContentHash(db, personId, contentHash);

        if (isDuplicate || !content) {
          finishJob(db, jobId, "succeeded", []);
          return { fragments: [] };
        }

        const source = library.createSource({
          personId,
          url: page.url,
          title,
          sourceType: "web",
          trustLevel: "unreviewed",
          crawlStatus: "succeeded"
        });

        db.prepare("update sources set fetched_at = ? where id = ?").run(now(), source.id);

        const fragment = library.createFragment({
          sourceId: source.id,
          personId,
          content,
          summary: content.slice(0, 180),
          timelineTag: "undated",
          evidenceType: "web_excerpt"
        });

        finishJob(db, jobId, "succeeded", [source.id, fragment.id]);

        return { fragments: [fragment] };
      } catch (error) {
        finishJob(db, jobId, "failed", [], error instanceof Error ? error.message : String(error));
        throw error;
      }
    }
  };
}
