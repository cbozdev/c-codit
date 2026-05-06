type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

function formatMessage(level: LogLevel, message: string, ctx?: LogContext): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  return ctx ? `${base} ${JSON.stringify(ctx)}` : base;
}

function shouldLog(level: LogLevel): boolean {
  if (process.env.NODE_ENV === "test") return false;
  if (level === "debug" && process.env.NODE_ENV === "production") return false;
  return true;
}

export const logger = {
  debug(message: string, ctx?: LogContext) {
    if (!shouldLog("debug")) return;
    console.debug(formatMessage("debug", message, ctx));
  },
  info(message: string, ctx?: LogContext) {
    if (!shouldLog("info")) return;
    console.info(formatMessage("info", message, ctx));
  },
  warn(message: string, ctx?: LogContext) {
    if (!shouldLog("warn")) return;
    console.warn(formatMessage("warn", message, ctx));
  },
  error(message: string, error?: unknown, ctx?: LogContext) {
    if (!shouldLog("error")) return;
    const errCtx: LogContext = {
      ...ctx,
      ...(error instanceof Error
        ? { errorMessage: error.message, stack: error.stack }
        : { error: String(error) }),
    };
    console.error(formatMessage("error", message, errCtx));
  },
};
