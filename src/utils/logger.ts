/**
 * Centralized error logging utility.
 * Use throughout the app for consistent, debuggable error output.
 * Logs are sent to the backend (CloudWatch) in both dev and prod, with separate streams.
 */

import type { Schema } from "../../amplify/data/resource";

type LogContext = {
  component?: string;
  operation?: string;
  extra?: Record<string, unknown>;
};

function formatError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

function buildPrefix(context: LogContext): string {
  const parts: string[] = [];
  if (context.component) parts.push(context.component);
  if (context.operation) parts.push(context.operation);
  return parts.length ? `[${parts.join(" ")}]` : "";
}

const env = import.meta.env.DEV ? "development" : "production";

/** Fire-and-forget: send log to backend. Swallows all errors to avoid recursion. */
function sendToBackend(level: string, message: string, context: LogContext): void {
  if (typeof window === "undefined") return;
  const payload = {
    level,
    message,
    env,
    component: context.component ?? null,
    operation: context.operation ?? null,
    extra: context.extra ?? null,
  };
  void import("aws-amplify/data")
    .then(({ generateClient }) => {
      const client = generateClient<Schema>();
      return client.mutations.logFrontendEvent(payload);
    })
    .catch(() => {});
}

/**
 * Log an error with full context. Use in catch blocks.
 */
export function logError(
  err: unknown,
  context: LogContext = {}
): void {
  const prefix = buildPrefix(context);
  const { message, stack } = formatError(err);
  const extra = context.extra ? ` ${JSON.stringify(context.extra)}` : "";

  console.error(`${prefix} Error: ${message}${extra}`);
  if (stack && import.meta.env.DEV) {
    console.error(`${prefix} Stack:`, stack);
  }

  sendToBackend("error", message, { ...context, extra: { ...context.extra, stack } });
}

/**
 * Log a warning (non-fatal).
 */
export function logWarn(
  message: string,
  context: LogContext = {}
): void {
  const prefix = buildPrefix(context);
  const extra = context.extra ? ` ${JSON.stringify(context.extra)}` : "";
  console.warn(`${prefix} ${message}${extra}`);
  sendToBackend("warn", message, context);
}

/**
 * Log informational / debug messages. Use for key flow milestones.
 */
export function logInfo(
  message: string,
  context: LogContext = {}
): void {
  const prefix = buildPrefix(context);
  const extra = context.extra ? ` ${JSON.stringify(context.extra)}` : "";
  console.info(`${prefix} ${message}${extra}`);
  sendToBackend("info", message, context);
}
