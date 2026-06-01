/**
 * [INPUT]: 依赖人物 seed 数据与选中状态渲染左侧人物矩阵
 * [OUTPUT]: 对外提供 PeoplePanel 组件
 * [POS]: src/components 的左侧导航面板，被 App 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
type PersonCard = {
  id: string;
  name: string;
  role: string;
  region: string;
  status: string;
  tags: string[];
};

export function PeoplePanel({
  people,
  selectedPersonId,
  onSelect
}: {
  people: PersonCard[];
  selectedPersonId: string;
  onSelect: (personId: string) => void;
}) {
  return (
    <aside className="panel panel-people" aria-label="People matrix">
      <div className="panel-header">
        <p className="eyebrow">Matrix</p>
        <h2>People</h2>
      </div>
      <div className="person-list">
        {people.map((person) => (
          <button
            key={person.id}
            className={`person-card${person.id === selectedPersonId ? " is-active" : ""}`}
            onClick={() => onSelect(person.id)}
            type="button"
          >
            <div className="person-card-top">
              <strong>{person.name}</strong>
              <span className={`status status-${person.status}`}>{person.status.replaceAll("_", " ")}</span>
            </div>
            <p>{person.role}</p>
            <p>{person.region}</p>
            <div className="tag-row">
              {person.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
