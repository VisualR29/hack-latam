type LogLevel = "debug" | "info" | "warn" | "error";

function emit(
  level: LogLevel,
  event: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (!import.meta.env.DEV) return;

  const payload = { event, msg: message, ...meta };
  const prefix = `[vibeguard:client] ${event}`;

  switch (level) {
    case "debug":
      console.debug(prefix, payload);
      break;
    case "info":
      console.info(prefix, payload);
      break;
    case "warn":
      console.warn(prefix, payload);
      break;
    case "error":
      console.error(prefix, payload);
      break;
  }
}

export const clientLog = {
  debug: emit.bind(null, "debug"),
  info: emit.bind(null, "info"),
  warn: emit.bind(null, "warn"),
  error(event: string, message: string, meta?: Record<string, unknown>) {
    emit("error", event, message, meta);
  },
};

export function clientTimer() {
  const t0 = performance.now();
  return () => Math.round(performance.now() - t0);
}
