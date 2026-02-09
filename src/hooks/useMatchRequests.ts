import { useState, useEffect, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { GOOGLE_LOGIN_CHECK } from "@/config";
import { getIdFromEmail } from "@/utils/userId";
import { logError, logInfo } from "@/utils/logger";

const client = generateClient<Schema>();

export type MatchRequestItem = Schema["MatchRequest"]["type"];

interface UseMatchRequestsOptions {
  currentUserId: string;
  currentUserEmail: string;
}

interface UseMatchRequestsReturn {
  pendingRequests: MatchRequestItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  acceptRequest: (requestId: string, fromUserId: string, fromEmail: string, fromName?: string) => Promise<boolean>;
  declineRequest: (requestId: string) => Promise<boolean>;
}

export function useMatchRequests({
  currentUserId,
  currentUserEmail,
}: UseMatchRequestsOptions): UseMatchRequestsReturn {
  const [pendingRequests, setPendingRequests] = useState<MatchRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authMode = GOOGLE_LOGIN_CHECK ? undefined : ("apiKey" as const);

  const loadRequests = useCallback(async () => {
    if (!currentUserEmail && !currentUserId) return;
    setIsLoading(true);
    setError(null);
    logInfo("Loading match requests", { component: "useMatchRequests", operation: "loadRequests", extra: { currentUserEmail, currentUserId } });
    try {
      const byEmail =
        currentUserEmail
          ? await client.models.MatchRequest.listMatchRequestByToEmail(
              { toEmail: currentUserEmail },
              authMode ? { authMode } : undefined
            )
          : { data: [] };
      const byUserId =
        currentUserId
          ? await client.models.MatchRequest.listMatchRequestByToUserId(
              { toUserId: currentUserId },
              authMode ? { authMode } : undefined
            )
          : { data: [] };

      const byEmailData = byEmail.data ?? [];
      const byUserIdData = byUserId.data ?? [];
      const combined = [...byEmailData, ...byUserIdData];
      const unique = combined.filter(
        (r, i, arr) => arr.findIndex((x) => x.id === r.id) === i
      );
      const pending = unique.filter((r) => r.status === "pending");
      setPendingRequests(pending);
      logInfo("Match requests loaded", { component: "useMatchRequests", operation: "loadRequests", extra: { count: pending.length } });
    } catch (err) {
      logError(err, { component: "useMatchRequests", operation: "loadRequests" });
      setError(err instanceof Error ? err.message : "Failed to load requests");
      setPendingRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, currentUserEmail, authMode]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const acceptRequest = useCallback(
    async (
      requestId: string,
      fromUserId: string,
      fromEmail: string,
      fromName?: string
    ): Promise<boolean> => {
      try {
        await client.models.MatchRequest.update(
          {
            id: requestId,
            status: "accepted",
          },
          authMode ? { authMode } : undefined
        );
        const { data: newMatch, errors } = await client.models.Match.create(
          {
            user1Id: fromUserId,
            user2Id: currentUserId,
            user1Email: fromEmail,
            user2Email: currentUserEmail,
            status: "active",
            isPromDate: true,
            createdAt: new Date().toISOString(),
          },
          authMode ? { authMode } : undefined
        );
        if (errors || !newMatch) {
          logError(errors?.[0], { component: "useMatchRequests", operation: "acceptRequest_createMatch", extra: { requestId, fromUserId, errors } });
          return false;
        }
        // Mark both users as excluded from discovery (partner match confirmed)
        try {
          const myProfileId = currentUserEmail ? getIdFromEmail(currentUserEmail.trim()) : null;
          const theirProfileId = fromEmail ? getIdFromEmail(fromEmail.trim()) : null;
          const { data: myProfile } = myProfileId
            ? await client.models.UserProfile.get({ id: myProfileId }, authMode ? { authMode } : undefined)
            : { data: null };
          const { data: theirProfile } = theirProfileId
            ? await client.models.UserProfile.get({ id: theirProfileId }, authMode ? { authMode } : undefined)
            : { data: null };
          if (myProfile?.id) {
            await client.models.UserProfile.update(
              { id: myProfile.id, excludeFromDiscovery: true },
              authMode ? { authMode } : undefined
            );
          }
          if (theirProfile?.id) {
            await client.models.UserProfile.update(
              { id: theirProfile.id, excludeFromDiscovery: true },
              authMode ? { authMode } : undefined
            );
          }
        } catch (err) {
          logError(err, { component: "useMatchRequests", operation: "setExcludeFromDiscovery", extra: { myEmail: currentUserEmail, theirEmail: fromEmail } });
        }
        await loadRequests();
        return true;
      } catch (err) {
        logError(err, { component: "useMatchRequests", operation: "acceptRequest", extra: { requestId } });
        return false;
      }
    },
    [currentUserId, currentUserEmail, authMode, loadRequests]
  );

  const declineRequest = useCallback(
    async (requestId: string): Promise<boolean> => {
      try {
        await client.models.MatchRequest.update(
          {
            id: requestId,
            status: "declined",
          },
          authMode ? { authMode } : undefined
        );
        await loadRequests();
        return true;
      } catch (err) {
        logError(err, { component: "useMatchRequests", operation: "declineRequest", extra: { requestId } });
        return false;
      }
    },
    [authMode, loadRequests]
  );

  return {
    pendingRequests,
    isLoading,
    error,
    refresh: loadRequests,
    acceptRequest,
    declineRequest,
  };
}
