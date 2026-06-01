/**
 * [INPUT]: 依赖 Vite React 插件与 Vitest 配置 API，区分前端单测与浏览器 e2e 边界
 * [OUTPUT]: 对外提供 Vite dev server 与 Vitest 测试范围配置
 * [POS]: 项目根目录的前端构建与单测配置，被 `vite` 与 `vitest` 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3001"
    }
  },
  test: {
    environment: "jsdom",
    include: ["src/test/**/*.test.ts?(x)", "server/test/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"]
  }
});
