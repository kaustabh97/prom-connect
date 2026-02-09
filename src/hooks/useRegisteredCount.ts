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
        // Paginate to get all users with completed onboarding
        let totalCount = 0;
        let nextToken: string | undefined;
        do {
          const { data, nextToken: token } = await client.models.UserProfile.list(
            { filter: { onboardingCompleted: { eq: true } }, nextToken, limit: 100 },
            { authMode: "apiKey" }
          );
          totalCount += data?.length ?? 0;
          nextToken = token ?? undefined;
        } while (nextToken);
        
        setCount(totalCount);
        setHasMore(false); // All pages fetched
        logInfo("Registered count loaded", { component, operation: "fetchRegisteredCount", extra: { count: totalCount } });
      } catch (err) {
        logError(err, { component, operation: "fetchRegisteredCount" });
        setCount(null);
      }
    };
    fetchCount();
  }, [component]);

  return { count, hasMore };
}
