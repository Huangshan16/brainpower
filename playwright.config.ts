/**
 * [INPUT]: 依赖 @playwright/test 配置 API、npm scripts 与本地 Chrome 浏览器
 * [OUTPUT]: 对外提供 Playwright e2e 配置与本地双服务启动策略
 * [POS]: 项目根目录的浏览器验收入口，被 `npm run test:e2e` 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:5173",
    browserName: "chromium",
    channel: "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 30_000
  }
});
