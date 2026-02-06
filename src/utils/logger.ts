/**
 * Centralized error logging utility.
 * Use throughout the app for consistent, debuggable error output.
 */

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
}
