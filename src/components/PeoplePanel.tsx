/**
 * [INPUT]: 依赖人物库列表、选中状态与导入/删除动作渲染左侧人物矩阵
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

const statusLabelMap: Record<string, string> = {
  needs_research: "待研究",
  ready_to_evaluate: "可直接评审",
  ready_to_distill: "待技能蒸馏",
  researching: "资料采集中"
};

export function PeoplePanel({
  people,
  selectedPersonId,
  onSelect,
  onImportNuwa,
  onDeleteSelected,
  isSyncing,
  isDeleting
}: {
  people: PersonCard[];
  selectedPersonId: string;
  onSelect: (personId: string) => void;
  onImportNuwa: () => void;
  onDeleteSelected: () => void;
  isSyncing?: boolean;
  isDeleting?: boolean;
}) {
  return (
    <aside className="panel panel-people" aria-label="人物矩阵">
      <div className="panel-header">
        <p className="eyebrow">人物库</p>
        <h2>人物矩阵</h2>
        <div className="panel-actions">
          <button disabled={isSyncing} onClick={onImportNuwa} type="button">
            {isSyncing ? "同步中..." : "同步女娲人物"}
          </button>
          <button className="secondary-button" disabled={!selectedPersonId || isDeleting} onClick={onDeleteSelected} type="button">
            {isDeleting ? "删除中..." : "删除当前人物"}
          </button>
        </div>
      </div>
      <div className="person-list">
        {people.length === 0 ? (
          <div className="panel-empty">
            <p className="workspace-note">人物库还是空的。先同步女娲人物，再把真实人物接入会话与蒸馏流程。</p>
          </div>
        ) : (
          people.map((person) => (
            <button
              key={person.id}
              className={`person-card${person.id === selectedPersonId ? " is-active" : ""}`}
              onClick={() => onSelect(person.id)}
              type="button"
            >
              <div className="person-card-top">
                <strong>{person.name}</strong>
                <span className={`status status-${person.status}`}>{statusLabelMap[person.status] ?? person.status}</span>
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
          ))
        )}
      </div>
    </aside>
  );
}
