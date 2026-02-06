import { useState, useEffect, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { GOOGLE_LOGIN_CHECK } from "@/config";
import { logError, logInfo } from "@/utils/logger";

const client = generateClient<Schema>();

// Types derived from the schema
type Match = Schema["Match"]["type"];

export interface MatchWithDetails extends Match {
  otherUserId: string;
  otherUserEmail: string;
  otherUserProfile?: Schema["UserProfile"]["type"];
}

interface UseMatchesOptions {
  currentUserId: string;
  currentUserEmail?: string;
}

interface UseMatchesReturn {
  matches: MatchWithDetails[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createMatch: (otherUserId: string, otherUserEmail?: string, compatScore?: number) => Promise<Match | null>;
  updateMatchConversation: (matchId: string, conversationId: string) => Promise<void>;
}

export function useMatches({ currentUserId, currentUserEmail }: UseMatchesOptions): UseMatchesReturn {
  const [matches, setMatches] = useState<MatchWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all matches for the current user
  const loadMatches = useCallback(async () => {
    if (!currentUserId) return;
    
    setIsLoading(true);
    setError(null);
    logInfo("Loading matches", { component: "useMatches", operation: "loadMatches", extra: { currentUserId } });
    try {
      const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
      const opts = authMode ? { authMode } : undefined;

      // Get matches where user is user1
      const { data: asUser1, errors: errors1 } =
        // @ts-ignore - authMode option
        await client.models.Match.listMatchByUser1Id({ user1Id: currentUserId }, opts);
      
      // Get matches where user is user2
      const { data: asUser2, errors: errors2 } =
        // @ts-ignore - authMode option
        await client.models.Match.listMatchByUser2Id({ user2Id: currentUserId }, opts);

      if (errors1 || errors2) {
        logError(errors1?.[0] ?? errors2?.[0], { component: "useMatches", operation: "loadMatches", extra: { errors1, errors2 } });
        setError("Failed to load matches");
        return;
      }

      // Transform matches to include "otherUser" info from current user's perspective
      const matchesAsUser1: MatchWithDetails[] = (asUser1 || [])
        .filter(m => m.status === "active")
        .map(m => ({
          ...m,
          otherUserId: m.user2Id,
          otherUserEmail: m.user2Email || "Anonymous",
        }));

      const matchesAsUser2: MatchWithDetails[] = (asUser2 || [])
        .filter(m => m.status === "active")
        .map(m => ({
          ...m,
          otherUserId: m.user1Id,
          otherUserEmail: m.user1Email || "Anonymous",
        }));

      // Combine and sort by creation date (newest first)
      const allMatches = [...matchesAsUser1, ...matchesAsUser2];
      allMatches.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      // Fetch other user profiles for richer display (name, etc.)
      const uniqueOtherUserIds = Array.from(new Set(allMatches.map((m) => m.otherUserId).filter(Boolean)));
      const profileMap: Record<string, Schema["UserProfile"]["type"] | undefined> = {};
      await Promise.all(
        uniqueOtherUserIds.map(async (id) => {
          try {
            const { data } =
              // @ts-ignore - authMode
              await client.models.UserProfile.get({ id }, opts);
            if (data) {
              profileMap[id] = data;
            }
          } catch (err) {
            logError(err, { component: "useMatches", operation: "fetchProfile", extra: { profileId: id } });
          }
        })
      );

      const enrichedMatches = allMatches.map((match) => ({
        ...match,
        otherUserEmail: match.otherUserEmail || profileMap[match.otherUserId]?.email || "Anonymous",
        otherUserProfile: profileMap[match.otherUserId],
      }));

      setMatches(enrichedMatches);
      logInfo("Matches loaded", { component: "useMatches", operation: "loadMatches", extra: { count: enrichedMatches.length } });
    } catch (err) {
      logError(err, { component: "useMatches", operation: "loadMatches" });
      setError(err instanceof Error ? err.message : "Failed to load matches");
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  // Create a new match (for testing or admin purposes)
  const createMatch = useCallback(async (
    otherUserId: string,
    otherUserEmail?: string,
    compatScore: number = 0.8
  ): Promise<Match | null> => {
    if (!currentUserId) {
      setError("No current user");
      return null;
    }

    try {
      const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
      const opts = authMode ? { authMode } : undefined;
      const { data, errors } =
        // @ts-ignore - authMode
        await client.models.Match.create(
          {
            user1Id: currentUserId,
            user2Id: otherUserId,
            user1Email: currentUserEmail,
            user2Email: otherUserEmail,
            compatScore,
            status: "active",
            createdAt: new Date().toISOString(),
          },
          opts
        );

      if (errors) {
        logError(errors[0], { component: "useMatches", operation: "createMatch", extra: { otherUserId, errors } });
        setError(errors[0]?.message || "Failed to create match");
        return null;
      }

      // Refresh matches list
      await loadMatches();
      return data;
    } catch (err) {
      logError(err, { component: "useMatches", operation: "createMatch", extra: { otherUserId } });
      setError(err instanceof Error ? err.message : "Failed to create match");
      return null;
    }
  }, [currentUserId, currentUserEmail, loadMatches]);

  // Update match with conversation ID
  const updateMatchConversation = useCallback(async (matchId: string, conversationId: string) => {
    try {
      const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
      const opts = authMode ? { authMode } : undefined;
      // @ts-ignore - authMode
      await client.models.Match.update(
        {
          id: matchId,
          conversationId,
        },
        opts
      );
      
      // Update local state
      setMatches(prev => prev.map(m => 
        m.id === matchId ? { ...m, conversationId } : m
      ));
    } catch (err) {
      logError(err, { component: "useMatches", operation: "updateMatch", extra: { matchId } });
    }
  }, []);

  // Load matches on mount and when userId changes
  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  return {
    matches,
    isLoading,
    error,
    refresh: loadMatches,
    createMatch,
    updateMatchConversation,
  };
}
