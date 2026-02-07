import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { logError, logInfo } from "@/utils/logger";

const client = generateClient<Schema>();

export function useRegisteredCount(component: string) {
  const [count, setCount] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const fetchCount = async () => {
      logInfo("Fetching registered user count", { component, operation: "fetchRegisteredCount" });
      try {
        const { data, nextToken } = await client.models.UserProfile.list(
          { filter: { onboardingCompleted: { eq: true } }, limit: 1000 },
          { authMode: "apiKey" }
        );
        const n = data?.length ?? 0;
        setCount(n);
        setHasMore(!!nextToken);
        logInfo("Registered count loaded", { component, operation: "fetchRegisteredCount", extra: { count: n, hasMore: !!nextToken } });
      } catch (err) {
        logError(err, { component, operation: "fetchRegisteredCount" });
        setCount(null);
      }
    };
    fetchCount();
  }, [component]);

  return { count, hasMore };
}
