import { useState, useEffect, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { GOOGLE_LOGIN_CHECK } from "@/config";
import { logError, logInfo } from "@/utils/logger";

const client = generateClient<Schema>();

export type PromAskItem = Schema["PromAskRequest"]["type"];

interface UsePromAskOptions {
  currentUserId: string;
}

interface UsePromAskReturn {
  pendingToMe: PromAskItem[];
  pendingFromMe: PromAskItem[];
  isLoading: boolean;
  sendPromAsk: (toUserId: string, matchId: string, message?: string) => Promise<{ ok: boolean; error?: string }>;
  acceptPromAsk: (requestId: string, matchId: string) => Promise<boolean>;
  declinePromAsk: (requestId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function usePromAsk({ currentUserId }: UsePromAskOptions): UsePromAskReturn {
  const [pendingToMe, setPendingToMe] = useState<PromAskItem[]>([]);
  const [pendingFromMe, setPendingFromMe] = useState<PromAskItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
  const opts = authMode ? { authMode } : undefined;

  const load = useCallback(async () => {
    if (!currentUserId) return;
    setIsLoading(true);
    try {
      // Paginate to get all PromAsk requests
      let allToMe: PromAskItem[] = [];
      let allFromMe: PromAskItem[] = [];
      
      // Fetch all "to me" requests with pagination
      let toMeNextToken: string | undefined;
      do {
        const toMeRes = await client.models.PromAskRequest.list(
          { filter: { toUserId: { eq: currentUserId } }, nextToken: toMeNextToken },
          opts
        );
        allToMe = allToMe.concat(toMeRes.data ?? []);
        toMeNextToken = toMeRes.nextToken ?? undefined;
      } while (toMeNextToken);
      
      // Fetch all "from me" requests with pagination
      let fromMeNextToken: string | undefined;
      do {
        const fromMeRes = await client.models.PromAskRequest.list(
          { filter: { fromUserId: { eq: currentUserId } }, nextToken: fromMeNextToken },
          opts
        );
        allFromMe = allFromMe.concat(fromMeRes.data ?? []);
        fromMeNextToken = fromMeRes.nextToken ?? undefined;
      } while (fromMeNextToken);
      
      const toMe = allToMe.filter((r) => r.status === "pending");
      const fromMe = allFromMe.filter((r) => r.status === "pending");
      setPendingToMe(toMe);
      setPendingFromMe(fromMe);
      logInfo("PromAsk requests loaded", { component: "usePromAsk", operation: "load", extra: { pendingToMe: toMe.length, pendingFromMe: fromMe.length } });
    } catch (err) {
      logError(err, { component: "usePromAsk", operation: "load" });
      setPendingToMe([]);
      setPendingFromMe([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, authMode]);

  useEffect(() => {
    load();
  }, [load]);

  const sendPromAsk = useCallback(
    async (toUserId: string, matchId: string, message?: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        await client.models.PromAskRequest.create(
          {
            fromUserId: currentUserId,
            toUserId,
            matchId,
            message: message || undefined,
            status: "pending",
            createdAt: new Date().toISOString(),
          },
          opts
        );
        await load();
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        logError(err, { component: "usePromAsk", operation: "send" });
        return { ok: false, error: msg };
      }
    },
    [currentUserId, opts, load]
  );

  const acceptPromAsk = useCallback(
    async (requestId: string, matchId: string): Promise<boolean> => {
      try {
        await client.models.PromAskRequest.update(
          { id: requestId, status: "accepted" },
          opts
        );
        await client.models.Match.update(
          { id: matchId, isPromDate: true },
          opts
        );
        const { data: match } = await client.models.Match.get({ id: matchId }, opts);
        if (match?.user1Id && match?.user2Id) {
          for (const uid of [match.user1Id, match.user2Id]) {
            try {
              await client.models.UserProfile.update(
                { id: uid, excludeFromDiscovery: true },
                opts
              );
            } catch (err) {
              logError(err, { component: "usePromAsk", operation: "setExcludeFromDiscovery", extra: { userId: uid } });
            }
          }
        }
        await load();
        return true;
      } catch (err) {
        logError(err, { component: "usePromAsk", operation: "acceptPromAsk", extra: { requestId } });
        return false;
      }
    },
    [opts, load]
  );

  const declinePromAsk = useCallback(
    async (requestId: string): Promise<boolean> => {
      try {
        await client.models.PromAskRequest.update(
          { id: requestId, status: "declined" },
          opts
        );
        await load();
        return true;
      } catch (err) {
        logError(err, { component: "usePromAsk", operation: "declinePromAsk", extra: { requestId } });
        return false;
      }
    },
    [opts, load]
  );

  return {
    pendingToMe,
    pendingFromMe,
    isLoading,
    sendPromAsk,
    acceptPromAsk,
    declinePromAsk,
    refresh: load,
  };
}
