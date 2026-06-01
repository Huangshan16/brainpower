/**
 * [INPUT]: 依赖选中人物、证据计数与可选 API seam 渲染 Distill 工作区
 * [OUTPUT]: 对外提供 DistillWorkspace 组件
 * [POS]: src/components 的技能蒸馏工作区，被 App 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useState } from "react";
import type { ApiClient } from "../api/client";

export function DistillWorkspace({
  personId,
  personName,
  evidenceCount,
  api
}: {
  personId: string;
  personName: string;
  evidenceCount: number;
  api?: ApiClient;
}) {
  const [status, setStatus] = useState("证据片段已就绪，可以开始蒸馏人物 Skill。");

  async function handleDistill() {
    if (!api) {
      setStatus("请接入可用的 API client，再执行真实技能蒸馏。");
      return;
    }

    await api.distillSkill({ personId });
    setStatus("Skill 已完成蒸馏，并带引用写入本地库。");
  }

  return (
    <section className="workspace-card">
      <div className="workspace-header">
        <p className="eyebrow">DISTILL</p>
        <h3>技能蒸馏工作台</h3>
      </div>
      <dl className="metric-grid">
        <div>
          <dt>人物</dt>
          <dd>{personName}</dd>
        </div>
        <div>
          <dt>证据数量</dt>
          <dd>{evidenceCount}</dd>
        </div>
        <div>
          <dt>Skill 结构</dt>
          <dd>心智模型、判断启发式、表达 DNA、反模式</dd>
        </div>
      </dl>
      <button onClick={() => void handleDistill()} type="button">
        开始蒸馏
      </button>
      <p className="workspace-note">{status}</p>
    </section>
  );
}
