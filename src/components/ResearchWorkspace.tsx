/**
 * [INPUT]: 依赖选中人物、表单状态与可选 API seam 渲染 Research 工作区
 * [OUTPUT]: 对外提供 ResearchWorkspace 组件
 * [POS]: src/components 的采集工作区，被 App 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useState } from "react";
import type { ApiClient } from "../api/client";

export function ResearchWorkspace({
  personName,
  personId,
  api,
  onFragmentsUpdate
}: {
  personName: string;
  personId: string;
  api?: ApiClient;
  onFragmentsUpdate?: (count: number) => void;
}) {
  const [seedUrl, setSeedUrl] = useState("");
  const [keywords, setKeywords] = useState("founder judgement, market timing, pattern recognition");
  const [crawlDepth, setCrawlDepth] = useState(2);
  const [status, setStatus] = useState("Seed a person and start a crawl.");

  async function handleStartCrawl() {
    if (!api || !seedUrl) {
      setStatus("Enter a seed URL to queue research.");
      return;
    }

    const result = await api.crawlSeedUrl({ personId, url: seedUrl });
    const count = Array.isArray(result.fragments) ? result.fragments.length : 0;
    onFragmentsUpdate?.(count);
    setStatus(count > 0 ? `Captured ${count} fresh evidence fragment(s).` : "No new fragments; duplicate evidence was skipped.");
  }

  return (
    <section className="workspace-card">
      <div className="workspace-header">
        <p className="eyebrow">Research</p>
        <h3>Evidence intake for {personName}</h3>
      </div>
      <label>
        Selected person
        <input value={personName} readOnly />
      </label>
      <label>
        Seed URL
        <input aria-label="Seed URL" onChange={(event) => setSeedUrl(event.target.value)} placeholder="https://example.com/interview" value={seedUrl} />
      </label>
      <label>
        Keywords
        <textarea onChange={(event) => setKeywords(event.target.value)} rows={4} value={keywords} />
      </label>
      <label>
        Crawl depth
        <input max={5} min={1} onChange={(event) => setCrawlDepth(Number(event.target.value))} type="number" value={crawlDepth} />
      </label>
      <div className="workspace-footer">
        <button onClick={() => void handleStartCrawl()} type="button">
          Start crawl
        </button>
        <p>{status}</p>
      </div>
    </section>
  );
}
