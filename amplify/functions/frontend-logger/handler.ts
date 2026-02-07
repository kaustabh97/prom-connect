type LogEventArgs = {
  level: string;
  message: string;
  component?: string | null;
  operation?: string | null;
  extra?: Record<string, unknown> | null;
};

export const handler = async (event: { arguments: LogEventArgs }) => {
  console.log("[frontend-logger] request", JSON.stringify(event));
  const { level, message, component, operation, extra } = event.arguments ?? {};
  const payload = {
    level,
    message,
    component: component ?? undefined,
    operation: operation ?? undefined,
    extra: extra ?? undefined,
    timestamp: new Date().toISOString(),
  };
  // Log to CloudWatch (Lambda's log stream)
  console.log(JSON.stringify(payload));
  return { ok: true };
};
