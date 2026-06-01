/**
 * [INPUT]: 依赖 React 状态、前端 API seam 与工作台组件组织三面板数字高人矩阵
 * [OUTPUT]: 对外提供 App 组件
 * [POS]: src 的前端应用骨架，被 main.tsx 与前端测试消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useState } from "react";
import { type ApiClient, createApiClient } from "./api/client";
import { DistillWorkspace } from "./components/DistillWorkspace";
import { EvaluateWorkspace } from "./components/EvaluateWorkspace";
import { EvidencePanel } from "./components/EvidencePanel";
import { PeoplePanel } from "./components/PeoplePanel";
import { ResearchWorkspace } from "./components/ResearchWorkspace";
import { WorkflowTabs, type Workflow } from "./components/WorkflowTabs";

type SeedPerson = {
  id: string;
  name: string;
  role: string;
  region: string;
  status: string;
  tags: string[];
};

const seedPeople: SeedPerson[] = [
  { id: "thiel", name: "Peter Thiel", role: "Investor", region: "US", status: "ready_to_evaluate", tags: ["contrarian", "monopoly"] },
  { id: "shen", name: "沈南鹏", role: "Investor", region: "CN", status: "ready_to_distill", tags: ["platform", "china"] },
  { id: "xu", name: "徐新", role: "Investor", region: "CN", status: "researching", tags: ["consumer", "retail"] },
  { id: "musk", name: "Elon Musk", role: "Entrepreneur", region: "US", status: "researching", tags: ["first-principles", "speed"] },
  { id: "huang", name: "黄仁勋", role: "AI Builder", region: "US", status: "ready_to_evaluate", tags: ["platform", "compute"] }
];

function renderWorkspace(
  workflow: Workflow,
  options: {
    personId: string;
    personName: string;
    evidenceCount: number;
    api?: ApiClient;
    onFragmentsUpdate: (count: number) => void;
  }
) {
  if (workflow === "Distill") {
    return <DistillWorkspace api={options.api} evidenceCount={options.evidenceCount} personId={options.personId} personName={options.personName} />;
  }

  if (workflow === "Evaluate") {
    return <EvaluateWorkspace api={options.api} personId={options.personId} />;
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
  const [selectedPersonId, setSelectedPersonId] = useState<string>(seedPeople[0].id);
  const [evidenceCount, setEvidenceCount] = useState(3);
  const selectedPerson = seedPeople.find((person) => person.id === selectedPersonId) ?? seedPeople[0];

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Digital Mentor Matrix</p>
          <h1>Digital High-Mind Matrix</h1>
        </div>
        <WorkflowTabs activeWorkflow={activeWorkflow} onChange={setActiveWorkflow} />
      </header>

      <main className="app-grid">
        <PeoplePanel onSelect={setSelectedPersonId} people={[...seedPeople]} selectedPersonId={selectedPersonId} />
        <section className="panel panel-workspace" aria-label="Workflow workspace">
          {renderWorkspace(activeWorkflow, {
            personId: selectedPerson.id,
            personName: selectedPerson.name,
            evidenceCount,
            api,
            onFragmentsUpdate: setEvidenceCount
          })}
        </section>
        <EvidencePanel activeWorkflow={activeWorkflow} evidenceCount={evidenceCount} personName={selectedPerson.name} />
      </main>
    </div>
  );
}
