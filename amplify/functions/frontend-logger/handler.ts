type LogEventArgs = {
  level: string;
  message: string;
  env: string;
  component?: string | null;
  operation?: string | null;
  extra?: Record<string, unknown> | null;
};

const LOG_GROUP_NAME = process.env.FRONTEND_LOG_GROUP ?? "/aws/amplify/prom-connect/frontend-logs";

export const handler = async (event: { arguments: LogEventArgs }) => {
  console.log("[frontend-logger] invoked", JSON.stringify({ hasArguments: !!event?.arguments }));
  const { level, message, env, component, operation, extra } = event.arguments ?? {};
  const payload = {
    level,
    message,
    env: env ?? "unknown",
    component: component ?? undefined,
    operation: operation ?? undefined,
    extra: extra ?? undefined,
    timestamp: new Date().toISOString(),
  };
  const logStreamName = env === "development" ? "dev" : "prod";

  try {
    const { CloudWatchLogsClient, CreateLogStreamCommand, PutLogEventsCommand } = await import(
      "@aws-sdk/client-cloudwatch-logs"
    );
    const region = process.env.AWS_REGION ?? "us-east-1";
    const client = new CloudWatchLogsClient({ region });
    const logEvent = {
      message: JSON.stringify(payload),
      timestamp: Date.now(),
    };

    try {
      await client.send(
        new CreateLogStreamCommand({
          logGroupName: LOG_GROUP_NAME,
          logStreamName,
        })
      );
    } catch (e: unknown) {
      if ((e as { name?: string }).name !== "ResourceAlreadyExistsException") throw e;
    }

    await client.send(
      new PutLogEventsCommand({
        logGroupName: LOG_GROUP_NAME,
        logStreamName,
        logEvents: [logEvent],
      })
    );
    console.log("[frontend-logger] wrote to CloudWatch", { logGroupName: LOG_GROUP_NAME, logStreamName, region });
  } catch (err) {
    console.error("[frontend-logger] failed to write to CloudWatch", err, JSON.stringify({ LOG_GROUP_NAME, logStreamName, payload }));
  }
  return { ok: true };
};
