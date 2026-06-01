/**
 * [INPUT]: 依赖状态文案渲染当前导入/蒸馏/运行任务摘要
 * [OUTPUT]: 对外提供 JobPanel 组件
 * [POS]: src/components 的任务摘要面板，被 ConversationWorkspace 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export function JobPanel({ note }: { note: string }) {
  return (
    <section className="conversation-section">
      <div className="section-heading">
        <h4>任务状态</h4>
      </div>
      <p className="workspace-note">{note}</p>
    </section>
  );
}
