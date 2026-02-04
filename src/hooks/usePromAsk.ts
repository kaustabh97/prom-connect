import { useState, useEffect, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { GOOGLE_LOGIN_CHECK } from "@/config";

const client = generateClient<Schema>();

export type PromAskItem = Schema["PromAskRequest"]["type"];

interface UsePromAskOptions {
  currentUserId: string;
}

interface UsePromAskReturn {
  pendingToMe: PromAskItem[];
  pendingFromMe: PromAskItem[];
  isLoading: boolean;
  sendPromAsk: (toUserId: string, matchId: string, message?: string) => Promise<boolean>;
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
      const [toMe, fromMe] = await Promise.all([
        client.models.PromAskRequest.listPromAskRequestByToUserId(
          { toUserId: currentUserId },
          opts
        ),
        client.models.PromAskRequest.listPromAskRequestByFromUserId(
          { fromUserId: currentUserId },
          opts
        ),
      ]);
      setPendingToMe((toMe.data ?? []).filter((r) => r.status === "pending"));
      setPendingFromMe((fromMe.data ?? []).filter((r) => r.status === "pending"));
    } catch (err) {
      console.error("[usePromAsk] Failed to load:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, authMode]);

  useEffect(() => {
    load();
  }, [load]);

  const sendPromAsk = useCallback(
    async (toUserId: string, matchId: string, message?: string): Promise<boolean> => {
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
        return true;
      } catch (err) {
        console.error("[usePromAsk] Send failed:", err);
        return false;
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
            } catch (_) {}
          }
        }
        await load();
        return true;
      } catch (err) {
        console.error("[usePromAsk] Accept failed:", err);
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
        console.error("[usePromAsk] Decline failed:", err);
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
