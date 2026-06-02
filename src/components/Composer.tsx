/**
 * [INPUT]: 依赖消息草稿、模式切换与发送回调渲染对话输入区
 * [OUTPUT]: 对外提供 Composer 组件
 * [POS]: src/components 的对话输入器，被 ConversationWorkspace 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
type ConversationMode = "direct" | "group";

export function Composer({
  draft,
  mode,
  onChange,
  onModeChange,
  onSubmit,
  disabled,
  directDisabled,
  groupDisabled
}: {
  draft: string;
  mode: ConversationMode;
  onChange: (value: string) => void;
  onModeChange: (mode: ConversationMode) => void;
  onSubmit: () => void;
  disabled?: boolean;
  directDisabled?: boolean;
  groupDisabled?: boolean;
}) {
  const submitDisabled = disabled || (mode === "direct" ? directDisabled : groupDisabled);

  return (
    <section className="conversation-section composer">
      <div className="composer-shell">
        <label className="composer-field">
          <span>输入消息</span>
          <textarea onChange={(event) => onChange(event.target.value)} rows={5} value={draft} />
        </label>
        <div className="composer-side">
          <div aria-label="对话模式" className="mode-switch" role="group">
            <button
              aria-pressed={mode === "direct"}
              className={mode === "direct" ? "is-active" : undefined}
              disabled={disabled || directDisabled}
              onClick={() => onModeChange("direct")}
              type="button"
            >
              单聊
            </button>
            <button
              aria-pressed={mode === "group"}
              className={mode === "group" ? "is-active" : undefined}
              disabled={disabled || groupDisabled}
              onClick={() => onModeChange("group")}
              type="button"
            >
              群聊
            </button>
          </div>
          <button disabled={submitDisabled} onClick={onSubmit} type="button">
            {mode === "group" ? "发起群聊" : "发送"}
          </button>
        </div>
      </div>
    </section>
  );
}
