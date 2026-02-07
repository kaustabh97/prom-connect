import { useState, useEffect, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { GOOGLE_LOGIN_CHECK } from "@/config";
import { logError, logInfo } from "@/utils/logger";

const client = generateClient<Schema>();

type Match = Schema["Match"]["type"];
type UserProfile = Schema["UserProfile"]["type"];

export interface PromDateMatch {
  match: Match;
  otherUserId: string;
  otherUserEmail: string;
  otherUserProfile?: UserProfile;
}

interface UsePromDateOptions {
  currentUserId: string;
}

interface UsePromDateReturn {
  promDate: PromDateMatch | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePromDate({ currentUserId }: UsePromDateOptions): UsePromDateReturn {
  const [promDate, setPromDate] = useState<PromDateMatch | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentUserId) return;
    setIsLoading(true);
    setError(null);
    logInfo("Loading prom date", { component: "usePromDate", operation: "load", extra: { currentUserId } });
    try {
      const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
      const opts = authMode ? { authMode } : undefined;

      const [as1, as2] = await Promise.all([
        client.models.Match.listMatchByUser1Id({ user1Id: currentUserId }, opts),
        client.models.Match.listMatchByUser2Id({ user2Id: currentUserId }, opts),
      ]);
      const all = [...(as1.data ?? []), ...(as2.data ?? [])];
      const prom = all.find((m) => m.status === "active" && m.isPromDate);
      if (!prom) {
        setPromDate(null);
        return;
      }
      const otherUserId = prom.user1Id === currentUserId ? prom.user2Id! : prom.user1Id!;
      const otherUserEmail =
        prom.user1Id === currentUserId ? prom.user2Email : prom.user1Email;
      let otherProfile: UserProfile | undefined;
      try {
        const { data } = await client.models.UserProfile.get({ id: otherUserId }, opts);
        otherProfile = data;
      } catch (err) {
        logError(err, { component: "usePromDate", operation: "fetchOtherProfile", extra: { otherUserId } });
      }
      setPromDate({
        match: prom,
        otherUserId,
        otherUserEmail: otherUserEmail || "",
        otherUserProfile: otherProfile,
      });
      logInfo("Prom date loaded", { component: "usePromDate", operation: "load", extra: { otherUserId } });
    } catch (err) {
      logError(err, { component: "usePromDate", operation: "loadPromDate", extra: { currentUserId } });
      setError(err instanceof Error ? err.message : "Failed to load prom date");
      setPromDate(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    load();
  }, [load]);

  return { promDate, isLoading, error, refresh: load };
}
