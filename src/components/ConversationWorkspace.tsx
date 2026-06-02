/**
 * [INPUT]: 依赖对话消息、运行态与输入器控制渲染主消息工作区
 * [OUTPUT]: 对外提供 ConversationWorkspace 组件
 * [POS]: src/components 的对话主工作区，被 App 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Composer } from "./Composer";
import { ConversationHeader } from "./ConversationHeader";
import { MessageTimeline } from "./MessageTimeline";

export function ConversationWorkspace({
  directDisabled,
  disabled,
  draft,
  groupDisabled,
  messages,
  mode,
  onChange,
  onModeChange,
  onStop,
  onSubmit,
  runState
}: {
  directDisabled: boolean;
  disabled: boolean;
  draft: string;
  groupDisabled: boolean;
  messages: Array<{ id: string; senderType: string; senderName: string; content: string }>;
  mode: "direct" | "group";
  onChange: (value: string) => void;
  onModeChange: (mode: "direct" | "group") => void;
  onStop: () => void;
  onSubmit: () => void;
  runState: "idle" | "direct" | "group_running" | "group_stopped" | "group_completed" | "group_failed";
}) {
  return (
    <section className="workspace-card conversation-workspace">
      <ConversationHeader onStop={onStop} runState={runState} title="对话工作台" />
      <MessageTimeline messages={messages} />
      <Composer
        disabled={disabled}
        directDisabled={directDisabled}
        draft={draft}
        groupDisabled={groupDisabled}
        mode={mode}
        onChange={onChange}
        onModeChange={onModeChange}
        onSubmit={onSubmit}
      />
    </section>
  );
}
