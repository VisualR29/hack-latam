import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function minLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "info").trim().toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

function shouldEmit(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel()];
}

function serializeError(err: unknown): Record<string, unknown> | undefined {
  if (!(err instanceof Error)) return undefined;
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    ...(typeof err === "object" &&
    err &&
    "code" in err &&
    typeof (err as { code?: string }).code === "string"
      ? { code: (err as { code: string }).code }
      : {}),
  };
}

function write(
  level: LogLevel,
  event: string,
  message: string,
  meta?: Record<string, unknown>,
  err?: unknown,
): void {
  if (!shouldEmit(level)) return;

  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    event,
    msg: message,
    ...meta,
  };

  if (err !== undefined) {
    const serialized = serializeError(err);
    if (serialized) payload.err = serialized;
    else if (err !== null && typeof err === "object") payload.err = err;
    else payload.err = { message: String(err) };
  }

  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug(event: string, message: string, meta?: Record<string, unknown>) {
    write("debug", event, message, meta);
  },
  info(event: string, message: string, meta?: Record<string, unknown>) {
    write("info", event, message, meta);
  },
  warn(
    event: string,
    message: string,
    meta?: Record<string, unknown>,
    err?: unknown,
  ) {
    write("warn", event, message, meta, err);
  },
  error(
    event: string,
    message: string,
    err?: unknown,
    meta?: Record<string, unknown>,
  ) {
    write("error", event, message, meta, err);
  },
};

export function newRequestId(): string {
  return randomUUID().slice(0, 8);
}

export function startTimer() {
  const t0 = performance.now();
  return () => Math.round(performance.now() - t0);
}
