/**
 * [INPUT]: 依赖选中人物、证据计数与可选 API seam 渲染 Distill 工作区
 * [OUTPUT]: 对外提供 DistillWorkspace 组件
 * [POS]: src/components 的技能蒸馏工作区，被 App 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useState } from "react";
import type { ApiClient } from "../api/client";

export function DistillWorkspace({
  personId,
  personName,
  evidenceCount,
  api
}: {
  personId: string;
  personName: string;
  evidenceCount: number;
  api?: ApiClient;
}) {
  const [status, setStatus] = useState("Ready to distill.");

  async function handleDistill() {
    if (!api) {
      setStatus("Attach an API client to distill a live skill.");
      return;
    }

    await api.distillSkill({ personId });
    setStatus("Skill distilled and stored with citations.");
  }

  return (
    <section className="workspace-card">
      <div className="workspace-header">
        <p className="eyebrow">Distill</p>
        <h3>Citation-aware skill distillation</h3>
      </div>
      <dl className="metric-grid">
        <div>
          <dt>Persona</dt>
          <dd>{personName}</dd>
        </div>
        <div>
          <dt>Evidence count</dt>
          <dd>{evidenceCount}</dd>
        </div>
        <div>
          <dt>Skill shape</dt>
          <dd>Mental models, heuristics, voice DNA, anti-patterns</dd>
        </div>
      </dl>
      <button onClick={() => void handleDistill()} type="button">
        Distill skill
      </button>
      <p className="workspace-note">{status}</p>
    </section>
  );
}
