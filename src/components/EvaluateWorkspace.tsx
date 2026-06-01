/**
 * [INPUT]: 依赖选中人物、可选 API seam 与本地 brief 状态渲染 Evaluate 工作区
 * [OUTPUT]: 对外提供 EvaluateWorkspace 组件
 * [POS]: src/components 的项目评审工作区，被 App 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useState } from "react";
import type { ApiClient } from "../api/client";

export function EvaluateWorkspace({
  personId,
  api
}: {
  personId: string;
  api?: ApiClient;
}) {
  const [title, setTitle] = useState("AI 创业者认知操作系统");
  const [brief, setBrief] = useState("一个把投资人和企业家判断力压缩成数字高人矩阵的研究型工作台。");
  const [status, setStatus] = useState("评审链路已就绪，可以发起第一轮矩阵判断。");
  const [isRunning, setIsRunning] = useState(false);

  async function handleRunMatrix() {
    if (!api) {
      setStatus("请先接入可用的 API client，再执行真实项目评审。");
      return;
    }

    setIsRunning(true);
    setStatus("正在运行评审矩阵...");

    try {
      await api.evaluateProject({ project: { title, brief }, personId, skillId: `${personId}-v1` });
      setStatus("评审结果已写入本地库。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "项目评审失败。");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <section className="workspace-card">
      <div className="workspace-header">
        <p className="eyebrow">EVALUATE</p>
        <h3>项目简介</h3>
      </div>
      <label>
        标题
        <input onChange={(event) => setTitle(event.target.value)} value={title} />
      </label>
      <label>
        简介
        <textarea onChange={(event) => setBrief(event.target.value)} rows={6} value={brief} />
      </label>
      <button disabled={isRunning} onClick={() => void handleRunMatrix()} type="button">
        {isRunning ? "运行中..." : "运行评审矩阵"}
      </button>
      <p className="workspace-note">{status}</p>
    </section>
  );
}
