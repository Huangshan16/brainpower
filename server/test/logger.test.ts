/**
 * [INPUT]: 依赖 node fs、tmpdir 与 logger 验证结构化日志文件输出
 * [OUTPUT]: 对外提供 logger 的 ndjson 写入与脱敏回归测试
 * [POS]: server/test 的日志边界测试，约束后端 debug 证据可落盘
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createLogger } from "../logger.js";

describe("logger", () => {
  test("writes sanitized ndjson records to a file", () => {
    const dir = mkdtempSync(join(tmpdir(), "brainpower-logs-"));
    const filePath = join(dir, "backend.ndjson");

    try {
      const logger = createLogger("loggerTest", { filePath, writeConsole: false });

      logger.error("model_request_failed", {
        apiKey: "secret",
        requestId: "req_1",
        raw: "x".repeat(500)
      });

      const [line] = readFileSync(filePath, "utf8").trim().split("\n");
      const payload = JSON.parse(line) as {
        event: string;
        details: { apiKey: string; raw: string; requestId: string };
      };

      expect(payload.event).toBe("model_request_failed");
      expect(payload.details.apiKey).toBe("[redacted]");
      expect(payload.details.requestId).toBe("req_1");
      expect(payload.details.raw).toContain("(truncated)");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
