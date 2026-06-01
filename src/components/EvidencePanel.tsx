/**
 * [INPUT]: 依赖选中人物、证据计数与 workflow 状态渲染右侧证据面板
 * [OUTPUT]: 对外提供 EvidencePanel 组件
 * [POS]: src/components 的证据与输出面板，被 App 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { Workflow } from "./WorkflowTabs";

export function EvidencePanel({
  personName,
  evidenceCount,
  activeWorkflow
}: {
  personName: string;
  evidenceCount: number;
  activeWorkflow: Workflow;
}) {
  return (
    <aside className="panel panel-evidence" aria-label="Evidence and output">
      <div className="panel-header">
        <p className="eyebrow">Evidence</p>
        <h2>{personName}</h2>
      </div>
      <div className="evidence-stack">
        <section className="evidence-card">
          <h3>Source fragments</h3>
          <p>{evidenceCount} captured fragment(s) ready for citation-aware distillation.</p>
        </section>
        <section className="evidence-card">
          <h3>Skill citations</h3>
          <p>{activeWorkflow === "Distill" ? "Evidence links are ready for the active distillation pass." : "Skill graph waiting for the next distillation run."}</p>
        </section>
        <section className="evidence-card">
          <h3>Verdicts</h3>
          <p>Invest / pass / needs more evidence results will stack here per persona.</p>
        </section>
        <section className="evidence-card">
          <h3>Critique chain</h3>
          <p>No critique chain yet. Route another persona through the latest evaluation to start one.</p>
        </section>
      </div>
    </aside>
  );
}
