import { useState, useEffect, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { GOOGLE_LOGIN_CHECK } from "@/config";

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
    } catch (err) {
      console.error("Error loading match requests:", err);
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
            compatScore: 1,
            status: "active",
            createdAt: new Date().toISOString(),
          },
          authMode ? { authMode } : undefined
        );
        if (errors || !newMatch) {
          console.error("Error creating match:", errors);
          return false;
        }
        // Mark both users as excluded from discovery (partner match confirmed)
        try {
          const { data: myProfiles } = await client.models.UserProfile.list(
            { filter: { email: { eq: currentUserEmail } } },
            authMode ? { authMode } : undefined
          );
          const { data: theirProfiles } = await client.models.UserProfile.list(
            { filter: { email: { eq: fromEmail } } },
            authMode ? { authMode } : undefined
          );
          if (myProfiles?.[0]?.id) {
            await client.models.UserProfile.update(
              { id: myProfiles[0].id, excludeFromDiscovery: true },
              authMode ? { authMode } : undefined
            );
          }
          if (theirProfiles?.[0]?.id) {
            await client.models.UserProfile.update(
              { id: theirProfiles[0].id, excludeFromDiscovery: true },
              authMode ? { authMode } : undefined
            );
          }
        } catch (excludeErr) {
          console.warn("Could not set excludeFromDiscovery:", excludeErr);
        }
        await loadRequests();
        return true;
      } catch (err) {
        console.error("Error accepting request:", err);
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
        console.error("Error declining request:", err);
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
