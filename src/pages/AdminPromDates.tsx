import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { getUserProfileById } from "@/lib/dataAccess";
import { GOOGLE_LOGIN_CHECK } from "@/config";
import { logError, logInfo } from "@/utils/logger";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import SparkleBackground from "@/components/SparkleBackground";

const client = generateClient<Schema>();

type MatchWithUserDetails = {
  match: Schema["Match"]["type"];
  user1Profile?: Schema["UserProfile"]["type"];
  user2Profile?: Schema["UserProfile"]["type"];
};

const getFlowType = (profile?: Schema["UserProfile"]["type"]): string => {
  if (!profile) return "Unknown";
  const hasPartner = (profile.partnerStatus ?? "").includes("Already found") || 
                     (profile.partnerEmail ?? "").trim() !== "";
  return hasPartner ? "Partner Flow" : "Looking Flow";
};

const formatDate = (dateString?: string | null): string => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
};

export default function AdminPromDates() {
  const [matches, setMatches] = useState<MatchWithUserDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [discoveryScoreStats, setDiscoveryScoreStats] = useState<{
    totalProfiles: number;
    profilesWithScore: number;
    profilesWithoutScore: number;
    lastScoreUpdate?: string;
  } | null>(null);
  const [computingScores, setComputingScores] = useState(false);

  const fetchMatches = async () => {
    try {
      setError(null);
      const opts = !GOOGLE_LOGIN_CHECK ? { authMode: "apiKey" as const } : undefined;

      // Fetch all matches
      const allMatches: Schema["Match"]["type"][] = [];
      let nextToken: string | undefined;
      do {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await (client.models.Match as any).list({ nextToken, limit: 100 }, opts);
        if (res.data) {
          allMatches.push(...(res.data as Schema["Match"]["type"][]));
        }
        nextToken = res.nextToken ?? undefined;
      } while (nextToken);

      logInfo("Fetched matches", { component: "AdminPromDates", operation: "fetchMatches", extra: { count: allMatches.length } });

      // Fetch user profiles for each match
      const matchesWithDetails: MatchWithUserDetails[] = [];
      for (const match of allMatches) {
        const user1Id = match.user1Id ?? undefined;
        const user2Id = match.user2Id ?? undefined;

        let user1Profile: Schema["UserProfile"]["type"] | undefined;
        let user2Profile: Schema["UserProfile"]["type"] | undefined;

        if (user1Id) {
          try {
            const res = await getUserProfileById(user1Id, opts);
            user1Profile = res.data ?? undefined;
          } catch (err) {
            logError(err, { component: "AdminPromDates", operation: "fetchUser1Profile", extra: { userId: user1Id } });
          }
        }

        if (user2Id) {
          try {
            const res = await getUserProfileById(user2Id, opts);
            user2Profile = res.data ?? undefined;
          } catch (err) {
            logError(err, { component: "AdminPromDates", operation: "fetchUser2Profile", extra: { userId: user2Id } });
          }
        }

        matchesWithDetails.push({
          match,
          user1Profile,
          user2Profile,
        });
      }

      // Sort by createdAt descending (newest first)
      matchesWithDetails.sort((a, b) => {
        const dateA = a.match.createdAt ? new Date(a.match.createdAt).getTime() : 0;
        const dateB = b.match.createdAt ? new Date(b.match.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setMatches(matchesWithDetails);
    } catch (err) {
      logError(err, { component: "AdminPromDates", operation: "fetchMatches" });
      setError(err instanceof Error ? err.message : "Failed to fetch matches");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchDiscoveryScoreStats = async () => {
    try {
      const opts = !GOOGLE_LOGIN_CHECK ? { authMode: "apiKey" as const } : undefined;
      const allProfiles: Schema["UserProfile"]["type"][] = [];
      let nextToken: string | undefined;
      do {
        const res = await client.models.UserProfile.list({ nextToken }, opts);
        if (res.data) {
          allProfiles.push(...res.data);
        }
        nextToken = res.nextToken ?? undefined;
      } while (nextToken);

      const profilesWithScore = allProfiles.filter((p) => p.discoveryScore != null).length;
      const profilesWithoutScore = allProfiles.length - profilesWithScore;
      
      // Find the most recent lastDiscoveryScoreAt
      const lastUpdate = allProfiles
        .map((p) => p.lastDiscoveryScoreAt)
        .filter((d): d is string => d != null)
        .sort()
        .reverse()[0];

      setDiscoveryScoreStats({
        totalProfiles: allProfiles.length,
        profilesWithScore,
        profilesWithoutScore,
        lastScoreUpdate: lastUpdate,
      });
    } catch (err) {
      logError(err, { component: "AdminPromDates", operation: "fetchDiscoveryScoreStats" });
    }
  };

  const handleComputeDiscoveryScores = async () => {
    try {
      setComputingScores(true);
      setError(null);
      const opts = !GOOGLE_LOGIN_CHECK ? { authMode: "apiKey" as const } : undefined;
      
      // Call the computeDiscoveryScores query
      const result = await client.queries.computeDiscoveryScores({}, opts);
      
      logInfo("Discovery scores computed", { 
        component: "AdminPromDates", 
        operation: "computeDiscoveryScores",
        extra: result.data 
      });
      
      // Refresh stats after computation
      await fetchDiscoveryScoreStats();
    } catch (err) {
      logError(err, { component: "AdminPromDates", operation: "computeDiscoveryScores" });
      setError(err instanceof Error ? err.message : "Failed to compute discovery scores");
    } finally {
      setComputingScores(false);
    }
  };

  useEffect(() => {
    fetchMatches();
    fetchDiscoveryScoreStats();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchMatches(), fetchDiscoveryScoreStats()]);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <SparkleBackground />
      <div className="relative z-10 container mx-auto px-4 py-8">
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">All Prom Dates</h1>
            <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
              {refreshing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive">
              {error}
            </div>
          )}

          {/* Discovery Score Stats */}
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">Discovery Score Status</h2>
              <Button 
                onClick={handleComputeDiscoveryScores} 
                disabled={computingScores}
                variant="outline"
                size="sm"
              >
                {computingScores ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Computing...
                  </>
                ) : (
                  "Compute Scores Now"
                )}
              </Button>
            </div>
            {discoveryScoreStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Total Profiles</div>
                  <div className="text-lg font-semibold">{discoveryScoreStats.totalProfiles}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">With Score</div>
                  <div className="text-lg font-semibold text-green-600">
                    {discoveryScoreStats.profilesWithScore}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Without Score</div>
                  <div className="text-lg font-semibold text-orange-600">
                    {discoveryScoreStats.profilesWithoutScore}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Last Updated</div>
                  <div className="text-sm font-medium">
                    {discoveryScoreStats.lastScoreUpdate 
                      ? formatDate(discoveryScoreStats.lastScoreUpdate)
                      : "Never"}
                  </div>
                </div>
              </div>
            )}
            <div className="mt-3 text-xs text-muted-foreground">
              💡 Check CloudWatch logs for the Lambda function to see detailed execution logs.
              Look for log group: <code className="bg-background px-1 rounded">/aws/lambda/...compute-discovery-scores...</code>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User 1</TableHead>
                  <TableHead>User 1 Flow</TableHead>
                  <TableHead>User 2</TableHead>
                  <TableHead>User 2 Flow</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prom Date</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No matches found
                    </TableCell>
                  </TableRow>
                ) : (
                  matches.map((item, idx) => {
                    const user1Name = item.user1Profile?.name || item.match.user1Email || "Unknown";
                    const user1Email = item.match.user1Email || item.user1Profile?.email || "N/A";
                    const user2Name = item.user2Profile?.name || item.match.user2Email || "Unknown";
                    const user2Email = item.match.user2Email || item.user2Profile?.email || "N/A";
                    const user1Flow = getFlowType(item.user1Profile);
                    const user2Flow = getFlowType(item.user2Profile);
                    const status = item.match.status || "active";
                    const isPromDate = item.match.isPromDate ?? false;

                    return (
                      <TableRow key={item.match.id || idx}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user1Name}</div>
                            <div className="text-sm text-muted-foreground">{user1Email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{user1Flow}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user2Name}</div>
                            <div className="text-sm text-muted-foreground">{user2Email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{user2Flow}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              status === "active"
                                ? "bg-green-500/20 text-green-700 dark:text-green-400"
                                : status === "unmatched"
                                ? "bg-gray-500/20 text-gray-700 dark:text-gray-400"
                                : "bg-red-500/20 text-red-700 dark:text-red-400"
                            }`}
                          >
                            {status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {isPromDate ? (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-primary/20 text-primary">
                              Yes
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(item.match.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            Total matches: {matches.length}
          </div>
        </div>
      </div>
    </div>
  );
}
