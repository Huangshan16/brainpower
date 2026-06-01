/**
 * [INPUT]: 依赖消息数组渲染对话时间线
 * [OUTPUT]: 对外提供 MessageTimeline 组件
 * [POS]: src/components 的消息流渲染器，被 ConversationWorkspace 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export function MessageTimeline({
  messages
}: {
  messages: Array<{ id: string; senderType: string; senderName: string; content: string }>;
}) {
  return (
    <section className="conversation-section conversation-timeline" aria-label="Conversation timeline">
      {messages.length === 0 ? (
        <p className="workspace-note">消息会在这里沉淀。你可以先单聊，也可以直接拉起群聊。</p>
      ) : (
        messages.map((message) => (
          <article className={`message-card message-${message.senderType}`} key={message.id}>
            <header>
              <strong>{message.senderName}</strong>
            </header>
            <p>{message.content}</p>
          </article>
        ))
      )}
    </section>
  );
}
