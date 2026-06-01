/**
 * [INPUT]: 依赖 @testing-library/jest-dom 扩展 DOM 断言
 * [OUTPUT]: 对外提供 Vitest 浏览器测试全局 setup
 * [POS]: src/test 的测试环境入口，被 vite.config.ts 的 setupFiles 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import "@testing-library/jest-dom/vitest";
