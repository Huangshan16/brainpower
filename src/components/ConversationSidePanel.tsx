/**
 * [INPUT]: 依赖人物库摘要、会话参与者与任务文案组合对话侧栏
 * [OUTPUT]: 对外提供 ConversationSidePanel 组件
 * [POS]: src/components 的对话右侧辅助栏，组合参与者托盘、人物加入器与任务摘要
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { JobPanel } from "./JobPanel";
import { ParticipantTray } from "./ParticipantTray";
import { PersonaPicker } from "./PersonaPicker";

type Participant = {
  id: string;
  name: string;
  skillId: string | null;
};

export function ConversationSidePanel({
  note,
  participants,
  people,
  selectedPersonId,
  onAdd,
  onRemove,
  onSelect
}: {
  note: string;
  participants: Participant[];
  people: Array<{ id: string; name: string }>;
  selectedPersonId: string;
  onAdd: () => void;
  onRemove: (participant: Participant) => void;
  onSelect: (personId: string) => void;
}) {
  return (
    <aside className="conversation-side">
      <ParticipantTray onRemove={onRemove} participants={participants} />
      <PersonaPicker onAdd={onAdd} onSelect={onSelect} people={people} selectedPersonId={selectedPersonId} />
      <JobPanel note={note} />
    </aside>
  );
}
