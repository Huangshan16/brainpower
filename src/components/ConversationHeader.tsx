/**
 * [INPUT]: 依赖会话标题、运行状态与终止回调渲染对话头部
 * [OUTPUT]: 对外提供 ConversationHeader 组件
 * [POS]: src/components 的对话工作台头部，被 ConversationWorkspace 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export function ConversationHeader({
  title,
  runState,
  onStop
}: {
  title: string;
  runState: "idle" | "direct" | "group_running" | "group_stopped";
  onStop: () => void;
}) {
  const statusLabel =
    runState === "group_running"
      ? "群聊进行中"
      : runState === "group_stopped"
        ? "群聊已停止"
        : runState === "direct"
          ? "单聊模式"
          : "等待发言";

  return (
    <div className="workspace-header conversation-header">
      <div>
        <p className="eyebrow">对话</p>
        <h3>{title}</h3>
      </div>
      <div className="conversation-header-actions">
        <span className="status-pill">{statusLabel}</span>
        <button disabled={runState !== "group_running"} onClick={onStop} type="button">
          终止群聊
        </button>
      </div>
    </div>
  );
}
