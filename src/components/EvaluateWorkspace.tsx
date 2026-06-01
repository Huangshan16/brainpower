/**
 * [INPUT]: 依赖选中人物、可选 API seam 与本地 brief 状态渲染 Evaluate 工作区
 * [OUTPUT]: 对外提供 EvaluateWorkspace 组件
 * [POS]: src/components 的项目评审工作区，被 App 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useState } from "react";
import type { ApiClient } from "../api/client";

export function EvaluateWorkspace({
  personId,
  api
}: {
  personId: string;
  api?: ApiClient;
}) {
  const [title, setTitle] = useState("AI founder cognition OS");
  const [brief, setBrief] = useState("A research console that compresses investor and operator judgment into a digital mentor matrix.");
  const [status, setStatus] = useState("Evaluation lane is primed for a first pass.");

  async function handleRunMatrix() {
    if (!api) {
      setStatus("Attach an API client to run a live evaluation.");
      return;
    }

    await api.evaluateProject({ project: { title, brief }, personId, skillId: `${personId}-v1` });
    setStatus("Matrix evaluation stored.");
  }

  return (
    <section className="workspace-card">
      <div className="workspace-header">
        <p className="eyebrow">Evaluate</p>
        <h3>Project brief</h3>
      </div>
      <label>
        Title
        <input onChange={(event) => setTitle(event.target.value)} value={title} />
      </label>
      <label>
        Brief
        <textarea onChange={(event) => setBrief(event.target.value)} rows={6} value={brief} />
      </label>
      <button onClick={() => void handleRunMatrix()} type="button">
        Run matrix
      </button>
      <p className="workspace-note">{status}</p>
    </section>
  );
}
