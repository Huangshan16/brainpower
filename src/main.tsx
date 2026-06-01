/**
 * [INPUT]: 依赖 react-dom/client、App 组件与全局样式启动前端工作台
 * [OUTPUT]: 挂载 React 应用到 #root
 * [POS]: src 的浏览器入口，被 index.html 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root container not found");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
