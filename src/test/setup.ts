/**
 * [INPUT]: 依赖 @testing-library/jest-dom 与 @testing-library/react 的 cleanup 维护浏览器测试环境
 * [OUTPUT]: 对外提供 Vitest 浏览器测试全局 setup，并在每个用例后清理 DOM
 * [POS]: src/test 的测试环境入口，被 vite.config.ts 的 setupFiles 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
