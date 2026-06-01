/**
 * [INPUT]: 依赖消息草稿、模式按钮与回调渲染对话输入区
 * [OUTPUT]: 对外提供 Composer 组件
 * [POS]: src/components 的对话输入器，被 ConversationWorkspace 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export function Composer({
  draft,
  onChange,
  onSend,
  onDirect,
  onGroup,
  disabled,
  directDisabled,
  groupDisabled
}: {
  draft: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onDirect: () => void;
  onGroup: () => void;
  disabled?: boolean;
  directDisabled?: boolean;
  groupDisabled?: boolean;
}) {
  return (
    <section className="conversation-section composer">
      <label>
        输入消息
        <textarea onChange={(event) => onChange(event.target.value)} rows={4} value={draft} />
      </label>
      <div className="composer-actions">
        <button disabled={disabled} onClick={onSend} type="button">
          发送
        </button>
        <button className="secondary-button" disabled={disabled || directDisabled} onClick={onDirect} type="button">
          单聊
        </button>
        <button className="secondary-button" disabled={disabled || groupDisabled} onClick={onGroup} type="button">
          群聊
        </button>
      </div>
    </section>
  );
}
