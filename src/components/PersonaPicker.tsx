/**
 * [INPUT]: 依赖人物库、选中值与添加回调渲染人物加入器
 * [OUTPUT]: 对外提供 PersonaPicker 组件
 * [POS]: src/components 的人物选择器，被 ConversationWorkspace 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export function PersonaPicker({
  people,
  selectedPersonId,
  onSelect,
  onAdd
}: {
  people: Array<{ id: string; name: string }>;
  selectedPersonId: string;
  onSelect: (personId: string) => void;
  onAdd: () => void;
}) {
  return (
    <section className="conversation-section">
      <div className="section-heading">
        <h4>添加人物</h4>
      </div>
      <div className="picker-row">
        <label className="picker-field">
          <span>添加人物</span>
          <select onChange={(event) => onSelect(event.target.value)} value={selectedPersonId}>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <button onClick={onAdd} type="button">
          加入会话
        </button>
      </div>
    </section>
  );
}
