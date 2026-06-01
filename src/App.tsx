/**
 * [INPUT]: 依赖 React 状态与副作用、前端 API seam 与工作台组件组织三面板数字高人矩阵
 * [OUTPUT]: 对外提供 App 组件
 * [POS]: src 的前端应用骨架，被 main.tsx 与前端测试消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useMemo, useState } from "react";
import { type ApiClient, createApiClient } from "./api/client";
import { ConversationWorkspace } from "./components/ConversationWorkspace";
import { DistillWorkspace } from "./components/DistillWorkspace";
import { EvidencePanel } from "./components/EvidencePanel";
import { PeoplePanel } from "./components/PeoplePanel";
import { ResearchWorkspace } from "./components/ResearchWorkspace";
import { WorkflowTabs, type Workflow } from "./components/WorkflowTabs";
import type { Persona } from "../shared/schemas";

type DisplayPerson = {
  id: string;
  name: string;
  role: string;
  region: string;
  status: string;
  tags: string[];
};

const roleLabelMap: Record<Persona["role"], string> = {
  investor: "投资人",
  entrepreneur: "创业者",
  ai_builder: "AI 企业家"
};

function toDisplayPeople(people: Persona[]): DisplayPerson[] {
  return people.map((person) => ({
    id: person.id,
    name: person.name,
    role: roleLabelMap[person.role] ?? person.role,
    region: person.region,
    status: person.status,
    tags: person.tags
  }));
}

function renderWorkspace(
  workflow: Workflow,
  options: {
    personId?: string;
    personName?: string;
    evidenceCount: number;
    api?: ApiClient;
    libraryPeople: Array<{ id: string; name: string }>;
    onFragmentsUpdate: (count: number) => void;
  }
) {
  if (!options.personId || !options.personName) {
    return (
      <section className="workspace-card">
        <div className="workspace-header">
          <p className="eyebrow">{workflow === "Research" ? "研究" : workflow === "Distill" ? "蒸馏" : "对话"}</p>
          <h3>人物库为空</h3>
        </div>
        <p className="workspace-note">先同步女娲人物，或在后端导入后再进入当前工作流。</p>
      </section>
    );
  }

  if (workflow === "Distill") {
    return <DistillWorkspace api={options.api} evidenceCount={options.evidenceCount} personId={options.personId} personName={options.personName} />;
  }

  if (workflow === "Conversation") {
    return <ConversationWorkspace api={options.api} libraryPeople={options.libraryPeople} selectedPersonId={options.personId} />;
  }

  return (
    <ResearchWorkspace
      api={options.api}
      onFragmentsUpdate={options.onFragmentsUpdate}
      personId={options.personId}
      personName={options.personName}
    />
  );
}

export function App({ api = createApiClient() }: { api?: ApiClient }) {
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow>("Research");
  const [people, setPeople] = useState<DisplayPerson[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [evidenceCount, setEvidenceCount] = useState(3);
  const [isSyncingPeople, setIsSyncingPeople] = useState(false);
  const [isDeletingPerson, setIsDeletingPerson] = useState(false);

  const selectedPerson = useMemo(() => people.find((person) => person.id === selectedPersonId) ?? null, [people, selectedPersonId]);
  const libraryPeople = useMemo(() => people.map(({ id, name }) => ({ id, name })), [people]);

  useEffect(() => {
    let isCancelled = false;

    async function loadPeople() {
      if (!api) {
        return;
      }

      const payload = await api.listPersonas();

      if (isCancelled) {
        return;
      }

      setPeople(toDisplayPeople(payload.people));
    }

    void loadPeople();

    return () => {
      isCancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (people.length === 0) {
      if (selectedPersonId) {
        setSelectedPersonId("");
      }

      return;
    }

    if (!selectedPersonId || !people.some((person) => person.id === selectedPersonId)) {
      setSelectedPersonId(people[0].id);
    }
  }, [people, selectedPersonId]);

  async function handleImportNuwaPersonas() {
    if (!api) {
      return;
    }

    setIsSyncingPeople(true);

    try {
      const payload = await api.importNuwaPersonas();
      setPeople(toDisplayPeople(payload.imported));
    } finally {
      setIsSyncingPeople(false);
    }
  }

  async function handleDeleteSelectedPerson() {
    if (!api || !selectedPerson) {
      return;
    }

    setIsDeletingPerson(true);

    try {
      await api.deletePersona({ personId: selectedPerson.id });
      setPeople((current) => current.filter((person) => person.id !== selectedPerson.id));
    } finally {
      setIsDeletingPerson(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">认知判断控制台</p>
          <h1>数字高人矩阵</h1>
        </div>
        <WorkflowTabs activeWorkflow={activeWorkflow} onChange={setActiveWorkflow} />
      </header>

      <main className="app-grid">
        <PeoplePanel
          isDeleting={isDeletingPerson}
          isSyncing={isSyncingPeople}
          onDeleteSelected={() => void handleDeleteSelectedPerson()}
          onImportNuwa={() => void handleImportNuwaPersonas()}
          onSelect={setSelectedPersonId}
          people={people}
          selectedPersonId={selectedPersonId}
        />
        <section className="panel panel-workspace" aria-label="工作区">
          {renderWorkspace(activeWorkflow, {
            personId: selectedPerson?.id,
            personName: selectedPerson?.name,
            evidenceCount,
            api,
            libraryPeople,
            onFragmentsUpdate: setEvidenceCount
          })}
        </section>
        <EvidencePanel
          activeWorkflow={activeWorkflow}
          evidenceCount={evidenceCount}
          onSelect={setSelectedPersonId}
          people={libraryPeople}
          personName={selectedPerson?.name ?? "未选择人物"}
          selectedPersonId={selectedPersonId}
        />
      </main>
    </div>
  );
}
