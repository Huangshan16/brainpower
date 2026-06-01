/**
 * [INPUT]: 依赖选中人物、证据计数与 workflow 状态渲染右侧证据面板
 * [OUTPUT]: 对外提供 EvidencePanel 组件
 * [POS]: src/components 的证据与输出面板，被 App 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { Workflow } from "./WorkflowTabs";

export function EvidencePanel({
  personName,
  people,
  selectedPersonId,
  onSelect,
  evidenceCount,
  activeWorkflow
}: {
  personName: string;
  people: Array<{ id: string; name: string }>;
  selectedPersonId: string;
  onSelect: (personId: string) => void;
  evidenceCount: number;
  activeWorkflow: Workflow;
}) {
  const selectorId = "evidence-person-selector";

  return (
    <aside className="panel panel-evidence" aria-label="证据与输出">
      <div className="panel-header">
        <div className="panel-header-top">
          <div>
            <p className="eyebrow">证据台</p>
            <h2>{personName}</h2>
          </div>
          <label className="panel-select-wrap" htmlFor={selectorId}>
            <span className="sr-only">右侧人物切换</span>
            <select
              className="panel-select"
              id={selectorId}
              onChange={(event) => onSelect(event.target.value)}
              value={selectedPersonId}
            >
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="evidence-stack">
        <section className="evidence-card">
          <h3>资料片段</h3>
          <p>当前已有 {evidenceCount} 条资料片段，可直接进入带引用的技能蒸馏。</p>
        </section>
        <section className="evidence-card">
          <h3>Skill 引用</h3>
          <p>{activeWorkflow === "Distill" ? "当前蒸馏轮次已就绪，可把证据片段映射到心智模型与判断启发式。" : "等待下一次蒸馏运行后，在这里沉淀人物的思维结构与引用链。"} </p>
        </section>
        <section className="evidence-card">
          <h3>对话摘要</h3>
          <p>{activeWorkflow === "Conversation" ? "单聊、群聊和终止群聊后的关键信息会在这里汇总。" : "会话摘要会在进入对话模式后开始累计。"} </p>
        </section>
        <section className="evidence-card">
          <h3>群聊链路</h3>
          <p>当前还没有群聊链路。添加多位人物并触发群聊后，这里会呈现轮次进展与终止状态。</p>
        </section>
      </div>
    </aside>
  );
}
