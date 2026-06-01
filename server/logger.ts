/**
 * [INPUT]: 依赖 node fs/path、console 输出、结构化事件名与上下文字段生成后端调试日志
 * [OUTPUT]: 对外提供 createLogger 工厂、Logger 类型与结构化日志能力
 * [POS]: server 的通用日志边界，被 routes 与 services 复用以统一 debug 语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type LogDetails = Record<string, unknown>;

export type Logger = {
  info(event: string, details?: LogDetails): void;
  warn(event: string, details?: LogDetails): void;
  error(event: string, details?: LogDetails): void;
};

type LoggerOptions = {
  filePath?: string | false;
  writeConsole?: boolean;
};

const REDACTED_KEYS = new Set(["apiKey", "authorization", "token"]);
const DEFAULT_LOG_FILE = "logs/backend.ndjson";

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > 400 ? `${value.slice(0, 400)}...(truncated)` : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        REDACTED_KEYS.has(key) ? "[redacted]" : sanitizeValue(nested)
      ])
    );
  }

  return value;
}

export function createLogger(scope: string, options: LoggerOptions = {}): Logger {
  const filePath = options.filePath === undefined ? process.env.LOG_FILE_PATH ?? DEFAULT_LOG_FILE : options.filePath;
  const writeConsole = options.writeConsole ?? true;

  function write(level: "INFO" | "WARN" | "ERROR", event: string, details: LogDetails = {}) {
    const payload = {
      ts: new Date().toISOString(),
      level,
      scope,
      event,
      details: sanitizeValue(details)
    };
    const line = JSON.stringify(payload);

    if (writeConsole) {
      console.log(line);
    }

    if (filePath) {
      mkdirSync(dirname(filePath), { recursive: true });
      appendFileSync(filePath, `${line}\n`);
    }
  }

  return {
    info(event, details) {
      write("INFO", event, details);
    },
    warn(event, details) {
      write("WARN", event, details);
    },
    error(event, details) {
      write("ERROR", event, details);
    }
  };
}
