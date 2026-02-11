import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { logError, logInfo } from "@/utils/logger";

const client = generateClient<Schema>();

export type PublicStats = {
  totalUsers: number;
  totalMatches: number;
  totalConversations: number;
  promDatesFinalised: number;
  usersByGender: Record<string, number>;
};

export function usePublicStats(component: string) {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      logInfo("Fetching public stats", { component, operation: "fetchPublicStats" });
      try {
        // UserProfile: total users (onboardingCompleted) + gender breakdown
        let totalUsers = 0;
        const usersByGender: Record<string, number> = { Men: 0, Women: 0, Other: 0 };
        let upNext: string | undefined;
        do {
          const res = await client.models.UserProfile.list(
            { filter: { onboardingCompleted: { eq: true } }, nextToken: upNext, limit: 500 },
            { authMode: "apiKey" }
          );
          const data = res.data ?? [];
          totalUsers += data.length;
          data.forEach((p) => {
            const g = (p.gender ?? "").trim() || "Other";
            const key = g === "Male" ? "Men" : g === "Female" ? "Women" : "Other";
            usersByGender[key] = (usersByGender[key] ?? 0) + 1;
          });
          upNext = res.nextToken ?? undefined;
        } while (upNext);

        // Match: total and prom dates
        let totalMatches = 0;
        let promDatesFinalised = 0;
        let mNext: string | undefined;
        do {
          const res = await (client.models.Match as any).list(
            { nextToken: mNext, limit: 500 },
            { authMode: "apiKey" }
          );
          const data = (res.data ?? []) as Schema["Match"]["type"][];
          totalMatches += data.length;
          promDatesFinalised += data.filter((m) => m.isPromDate === true).length;
          mNext = res.nextToken ?? undefined;
        } while (mNext);

        // Conversation: total
        let totalConversations = 0;
        let cNext: string | undefined;
        do {
          const res = await client.models.Conversation.list(
            { nextToken: cNext, limit: 500 },
            { authMode: "apiKey" }
          );
          totalConversations += res.data?.length ?? 0;
          cNext = res.nextToken ?? undefined;
        } while (cNext);

        setStats({
          totalUsers,
          totalMatches,
          totalConversations,
          promDatesFinalised,
          usersByGender,
        });
        logInfo("Public stats loaded", { component, operation: "fetchPublicStats", extra: { totalUsers, totalMatches } });
      } catch (err) {
        logError(err, { component, operation: "fetchPublicStats" });
        setError(err instanceof Error ? err.message : "Failed to load statistics");
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [component]);

  return { stats, loading, error };
}
