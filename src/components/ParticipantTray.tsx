/**
 * [INPUT]: 依赖会话参与者列表与移除回调渲染参与者托盘
 * [OUTPUT]: 对外提供 ParticipantTray 组件
 * [POS]: src/components 的对话参与者托盘，被 ConversationWorkspace 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export function ParticipantTray({
  participants,
  onRemove
}: {
  participants: Array<{ id: string; name: string; skillId: string }>;
  onRemove: (participant: { id: string; name: string; skillId: string }) => void;
}) {
  const participantLabel = participants.length === 0 ? "暂无" : `${participants.length} 位`;

  return (
    <section className="conversation-section">
      <div className="section-heading">
        <h4>会话人物</h4>
        <span>{participantLabel}</span>
      </div>
      <div className="participant-tray">
        {participants.length === 0 ? (
          <p className="workspace-note">先加入 1 位人物才能单聊，至少 2 位人物才能拉起真正的群聊。</p>
        ) : (
          participants.map((participant) => (
            <div className="participant-chip" key={`${participant.id}-${participant.skillId}`}>
              <span>{participant.name}</span>
              <button aria-label={`移除 ${participant.name}`} onClick={() => onRemove(participant)} type="button">
                移除
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
