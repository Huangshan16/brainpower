/**
 * [INPUT]: 依赖 workflow 状态与切换回调渲染研究、蒸馏、评审分段控件
 * [OUTPUT]: 对外提供 WorkflowTabs 组件与 Workflow 类型
 * [POS]: src/components 的主工作流切换器，被 App 与工作区共享
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export type Workflow = "Research" | "Distill" | "Evaluate";

const workflows: Workflow[] = ["Research", "Distill", "Evaluate"];
const workflowLabelMap: Record<Workflow, string> = {
  Research: "研究",
  Distill: "蒸馏",
  Evaluate: "评审"
};

export function WorkflowTabs({
  activeWorkflow,
  onChange
}: {
  activeWorkflow: Workflow;
  onChange: (workflow: Workflow) => void;
}) {
  return (
    <div className="workflow-tabs" role="tablist" aria-label="Workflow tabs">
      {workflows.map((workflow) => (
        <button
          key={workflow}
          className={`workflow-tab${workflow === activeWorkflow ? " is-active" : ""}`}
          onClick={() => onChange(workflow)}
          type="button"
        >
          {workflowLabelMap[workflow]}
        </button>
      ))}
    </div>
  );
}
