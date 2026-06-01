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
  const [keywords, setKeywords] = useState("投资逻辑、创始人判断、行业周期、关键复盘");
  const [crawlDepth, setCrawlDepth] = useState(2);
  const [status, setStatus] = useState("为当前人物补充种子链接后，即可开始采集公开资料。");

  async function handleStartCrawl() {
    if (!api || !seedUrl) {
      setStatus("请先填写种子链接，再把采集任务送入队列。");
      return;
    }

    const result = await api.crawlSeedUrl({ personId, url: seedUrl });
    const count = Array.isArray(result.fragments) ? result.fragments.length : 0;
    onFragmentsUpdate?.(count);
    setStatus(count > 0 ? `已采集 ${count} 条新的资料片段。` : "没有新增片段，重复证据已自动跳过。");
  }

  return (
    <section className="workspace-card">
      <div className="workspace-header">
        <p className="eyebrow">研究</p>
        <h3>{personName}的证据采集</h3>
      </div>
      <label>
        当前人物
        <input value={personName} readOnly />
      </label>
      <label>
        种子链接
        <input aria-label="种子链接" onChange={(event) => setSeedUrl(event.target.value)} placeholder="https://example.com/interview" value={seedUrl} />
      </label>
      <label>
        关注主题
        <textarea onChange={(event) => setKeywords(event.target.value)} rows={4} value={keywords} />
      </label>
      <label>
        采集深度
        <input max={5} min={1} onChange={(event) => setCrawlDepth(Number(event.target.value))} type="number" value={crawlDepth} />
      </label>
      <div className="workspace-footer">
        <button onClick={() => void handleStartCrawl()} type="button">
          开始采集
        </button>
        <p>{status}</p>
      </div>
    </section>
  );
}
