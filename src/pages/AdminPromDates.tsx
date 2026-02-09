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
import { Loader2, RefreshCw, Users, Heart, MessageCircle, TrendingUp, UserCheck, Home, Shield, AlertTriangle } from "lucide-react";
import SparkleBackground from "@/components/SparkleBackground";
import { useNavigate } from "react-router-dom";
import { getUserProfileFromCognito } from "@/utils/auth";

const client = generateClient<Schema>();

type MatchWithUserDetails = {
  match: Schema["Match"]["type"];
  user1Profile?: Schema["UserProfile"]["type"];
  user2Profile?: Schema["UserProfile"]["type"];
  promDateType?: "looking-flow" | "partner-iima" | "partner-outside";
  hasPromAsk?: boolean; // For active matches: whether a prom ask request exists
};

type DashboardStats = {
  // User Stats
  totalUsers: number;
  usersLookingFlow: number;
  usersPartnerFlow: number;
  usersCompletedOnboarding: number;
  usersByGender: Record<string, number>;
  usersByCohort: Record<string, number>;
  
  // Match Stats
  totalMatches: number;
  activeMatches: number;
  promDates: number;
  unmatchedMatches: number;
  matchesToday: number;
  matchesThisWeek: number;
  
  // Like Stats
  totalLikes: number;
  mutualLikes: number;
  likesToday: number;
  likesThisWeek: number;
  
  // Chat Stats
  totalConversations: number;
  conversationsWithMessages: number;
  totalMessages: number;
  messagesToday: number;
  messagesThisWeek: number;
  avgMessagesPerConversation: number;
  
  // Match Request Stats
  totalMatchRequests: number;
  pendingMatchRequests: number;
  acceptedMatchRequests: number;
  declinedMatchRequests: number;
  
  // Discovery Stats
  profilesInDiscovery: number;
  profilesExcludedFromDiscovery: number;
  discoveryScoreStats: {
    totalProfiles: number;
    profilesWithScore: number;
    profilesWithoutScore: number;
    lastScoreUpdate?: string;
    profilesWithoutScoreReasons: {
      onboardingNotCompleted: number;
      excludedFromDiscovery: number;
      partnerFlow: number;
      noId: number;
    };
  };
};

const getFlowType = (profile?: Schema["UserProfile"]["type"]): string => {
  if (!profile) return "Unknown";
  const hasPartner = (profile.partnerStatus ?? "").includes("Already found") || 
                     (profile.partnerEmail ?? "").trim() !== "";
  return hasPartner ? "Partner Flow" : "Looking Flow";
};

const isIIMACouple = (
  match: Schema["Match"]["type"],
  user1Profile?: Schema["UserProfile"]["type"],
  user2Profile?: Schema["UserProfile"]["type"],
  promDateType?: "looking-flow" | "partner-iima" | "partner-outside"
): boolean => {
  // If it's partner-outside, it's not IIMA
  if (promDateType === "partner-outside") return false;
  
  // Check if both users have IIMA emails
  if (user1Profile && user2Profile) {
    const user1IsIIMA = (user1Profile.email ?? "").endsWith("@iima.ac.in");
    const user2IsIIMA = (user2Profile.email ?? "").endsWith("@iima.ac.in");
    return user1IsIIMA && user2IsIIMA;
  }
  
  // Fallback: check emails from match record
  const user1IsIIMA = (match.user1Email ?? "").endsWith("@iima.ac.in");
  const user2IsIIMA = (match.user2Email ?? "").endsWith("@iima.ac.in");
  return user1IsIIMA && user2IsIIMA;
};

const formatDate = (dateString?: string | null): string => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
};

const isToday = (dateString?: string | null): boolean => {
  if (!dateString) return false;
  try {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  } catch {
    return false;
  }
};

const isThisWeek = (dateString?: string | null): boolean => {
  if (!dateString) return false;
  try {
    const date = new Date(dateString);
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return date >= weekAgo;
  } catch {
    return false;
  }
};

// Admin emails allowed to access the dashboard
const ALLOWED_ADMIN_EMAILS = [
  "p24kaustabh@iima.ac.in",
  "p24dipak@iima.ac.in",
  "p24sushruti@iima.ac.in",
];

export default function AdminPromDates() {
  const navigate = useNavigate();
  const [promDates, setPromDates] = useState<MatchWithUserDetails[]>([]);
  const [activeMatches, setActiveMatches] = useState<MatchWithUserDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [computingScores, setComputingScores] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  const fetchAllStats = async () => {
    try {
      setError(null);
      const opts = !GOOGLE_LOGIN_CHECK ? { authMode: "apiKey" as const } : undefined;

      // Fetch all data with pagination
      const [allProfiles, allMatches, allLikes, allConversations, allMessages, allMatchRequests] = await Promise.all([
        fetchAllWithPagination(client.models.UserProfile.list.bind(client.models.UserProfile), opts),
        fetchAllWithPagination((client.models.Match as any).list.bind(client.models.Match), opts),
        fetchAllWithPagination((client.models.Like as any).list.bind(client.models.Like), opts),
        fetchAllWithPagination((client.models.Conversation as any).list.bind(client.models.Conversation), opts),
        fetchAllWithPagination((client.models.Message as any).list.bind(client.models.Message), opts),
        fetchAllWithPagination((client.models.MatchRequest as any).list.bind(client.models.MatchRequest), opts),
      ]);

      // Calculate user stats
      const totalUsers = allProfiles.length;
      const usersCompletedOnboarding = allProfiles.filter(p => p.onboardingCompleted === true).length;
      const usersLookingFlow = allProfiles.filter(p => {
        const hasPartner = (p.partnerStatus ?? "").includes("Already found") || (p.partnerEmail ?? "").trim() !== "";
        return !hasPartner;
      }).length;
      const usersPartnerFlow = totalUsers - usersLookingFlow;
      
      const usersByGender: Record<string, number> = {};
      const usersByCohort: Record<string, number> = {};
      allProfiles.forEach(p => {
        const gender = p.gender || "Unknown";
        usersByGender[gender] = (usersByGender[gender] || 0) + 1;
        const cohort = p.cohort || "Unknown";
        usersByCohort[cohort] = (usersByCohort[cohort] || 0) + 1;
      });

      // Calculate match stats
      const totalMatches = allMatches.length;
      const activeMatches = allMatches.filter(m => m.status === "active").length;
      const promDates = allMatches.filter(m => m.isPromDate === true).length;
      const unmatchedMatches = allMatches.filter(m => m.status === "unmatched").length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matchesToday = allMatches.filter((m: any) => isToday(m.createdAt)).length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matchesThisWeek = allMatches.filter((m: any) => isThisWeek(m.createdAt)).length;

      // Calculate like stats
      const totalLikes = allLikes.length;
      const likesToday = allLikes.filter(l => isToday(l.createdAt)).length;
      const likesThisWeek = allLikes.filter(l => isThisWeek(l.createdAt)).length;
      
      // Calculate mutual likes (pairs where A liked B and B liked A)
      const likedBy: Record<string, Set<string>> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allLikes.forEach((like: any) => {
        const from = like.fromUserId;
        const to = like.toUserId;
        if (from && to && from !== to) {
          if (!likedBy[from]) likedBy[from] = new Set();
          likedBy[from].add(to);
        }
      });
      let mutualLikes = 0;
      const checkedPairs = new Set<string>();
      Object.entries(likedBy).forEach(([from, tos]) => {
        tos.forEach(to => {
          if (likedBy[to]?.has(from)) {
            const pairKey = from < to ? `${from}|${to}` : `${to}|${from}`;
            if (!checkedPairs.has(pairKey)) {
              checkedPairs.add(pairKey);
              mutualLikes++;
            }
          }
        });
      });

      // Calculate chat stats
      const totalConversations = allConversations.length;
      const conversationsWithMessages = new Set(allMessages.map(m => m.conversationId).filter(Boolean)).size;
      const totalMessages = allMessages.length;
      const messagesToday = allMessages.filter(m => isToday(m.sentAt)).length;
      const messagesThisWeek = allMessages.filter(m => isThisWeek(m.sentAt)).length;
      const avgMessagesPerConversation = totalConversations > 0 ? (totalMessages / totalConversations).toFixed(1) : "0";

      // Calculate match request stats
      const totalMatchRequests = allMatchRequests.length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pendingMatchRequests = allMatchRequests.filter((r: any) => r.status === "pending").length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const acceptedMatchRequests = allMatchRequests.filter((r: any) => r.status === "accepted").length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const declinedMatchRequests = allMatchRequests.filter((r: any) => r.status === "declined" || r.status === "withdrawn").length;

      // Calculate discovery stats
      const profilesInDiscovery = allProfiles.filter(p => 
        p.onboardingCompleted === true && 
        p.excludeFromDiscovery !== true &&
        !(typeof p.bio === "string" && p.bio.trim().startsWith("Partner:"))
      ).length;
      const profilesExcludedFromDiscovery = allProfiles.filter(p => p.excludeFromDiscovery === true).length;
      
      const profilesWithScore = allProfiles.filter(p => p.discoveryScore != null).length;
      const profilesWithoutScore = allProfiles.length - profilesWithScore;
      const lastScoreUpdate = allProfiles
        .map(p => p.lastDiscoveryScoreAt)
        .filter((d): d is string => d != null)
        .sort()
        .reverse()[0];

      // Analyze why profiles don't have scores
      const profilesWithoutScoreReasons = {
        onboardingNotCompleted: allProfiles.filter(p => p.onboardingCompleted !== true).length,
        excludedFromDiscovery: allProfiles.filter(p => p.excludeFromDiscovery === true).length,
        partnerFlow: allProfiles.filter(p => typeof p.bio === "string" && p.bio.trim().startsWith("Partner:")).length,
        noId: allProfiles.filter(p => !p.id).length,
      };

      setStats({
        totalUsers,
        usersLookingFlow,
        usersPartnerFlow,
        usersCompletedOnboarding,
        usersByGender,
        usersByCohort,
        totalMatches,
        activeMatches,
        promDates,
        unmatchedMatches,
        matchesToday,
        matchesThisWeek,
        totalLikes,
        mutualLikes,
        likesToday,
        likesThisWeek,
        totalConversations,
        conversationsWithMessages,
        totalMessages,
        messagesToday,
        messagesThisWeek,
        avgMessagesPerConversation: parseFloat(avgMessagesPerConversation),
        totalMatchRequests,
        pendingMatchRequests,
        acceptedMatchRequests,
        declinedMatchRequests,
        profilesInDiscovery,
        profilesExcludedFromDiscovery,
        discoveryScoreStats: {
          totalProfiles: allProfiles.length,
          profilesWithScore,
          profilesWithoutScore,
          lastScoreUpdate,
          profilesWithoutScoreReasons,
        },
      });

      logInfo("Fetched all stats", { component: "AdminPromDates", operation: "fetchAllStats" });
    } catch (err) {
      logError(err, { component: "AdminPromDates", operation: "fetchAllStats" });
      setError(err instanceof Error ? err.message : "Failed to fetch stats");
    }
  };

  // Helper function to fetch all records with pagination
  const fetchAllWithPagination = async <T,>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listFn: (opts?: any) => Promise<{ data?: T[]; nextToken?: string }>,
    opts?: { authMode?: "apiKey" }
  ): Promise<T[]> => {
    const all: T[] = [];
    let nextToken: string | undefined;
    do {
      const res = await listFn({ nextToken, limit: 100, ...opts });
      if (res.data) {
        all.push(...res.data);
      }
      nextToken = res.nextToken ?? undefined;
    } while (nextToken);
    return all;
  };

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

      // Fetch all PromAskRequests to identify looking-flow prom dates
      const allPromAsks: Schema["PromAskRequest"]["type"][] = [];
      let promAskNextToken: string | undefined;
      do {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await (client.models.PromAskRequest as any).list({ nextToken: promAskNextToken, limit: 100 }, opts);
        if (res.data) {
          allPromAsks.push(...(res.data as Schema["PromAskRequest"]["type"][]));
        }
        promAskNextToken = res.nextToken ?? undefined;
      } while (promAskNextToken);

      // Create a set of matchIds that have accepted PromAskRequests (looking-flow prom dates)
      const lookingFlowPromDateMatchIds = new Set(
        allPromAsks
          .filter((ask) => ask.status === "accepted" && ask.matchId)
          .map((ask) => ask.matchId!)
      );

      // Create a map of matchIds to prom ask status (for active matches table)
      const matchIdToPromAskStatus = new Map<string, boolean>();
      allPromAsks.forEach((ask) => {
        if (ask.matchId) {
          matchIdToPromAskStatus.set(ask.matchId, true); // Any prom ask (pending/accepted/declined) means "Asked"
        }
      });

      // Fetch all UserProfiles to find partner flow non-IIMA prom dates (have partnerEmail but no Match)
      const allProfiles: Schema["UserProfile"]["type"][] = [];
      let profileNextToken: string | undefined;
      do {
        const res = await client.models.UserProfile.list({ nextToken: profileNextToken }, opts);
        if (res.data) {
          allProfiles.push(...res.data);
        }
        profileNextToken = res.nextToken ?? undefined;
      } while (profileNextToken);

      // Find profiles with partnerEmail set (non-IIMA partner flow prom dates)
      // These don't have Match records, so we'll create virtual entries for them
      const outsidePartnerProfiles = allProfiles.filter(
        (p) =>
          (p.partnerEmail ?? "").trim() !== "" &&
          !(p.partnerEmail ?? "").endsWith("@iima.ac.in") &&
          (p.partnerStatus ?? "").includes("Already found")
      );

      logInfo("Fetched matches", { 
        component: "AdminPromDates", 
        operation: "fetchMatches", 
        extra: { 
          totalMatches: allMatches.length,
          promDates: allMatches.filter(m => m.isPromDate === true).length,
          activeMatches: allMatches.filter(m => m.status === "active" && m.isPromDate !== true).length,
          lookingFlowPromDates: lookingFlowPromDateMatchIds.size
        } 
      });

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

        // Determine prom date type
        let promDateType: "looking-flow" | "partner-iima" | "partner-outside" | undefined;
        if (match.isPromDate === true) {
          if (lookingFlowPromDateMatchIds.has(match.id!)) {
            promDateType = "looking-flow";
          } else if (user1Profile && user2Profile) {
            // Check if both are IIMA (have @iima.ac.in emails)
            const user1IsIIMA = (user1Profile.email ?? "").endsWith("@iima.ac.in");
            const user2IsIIMA = (user2Profile.email ?? "").endsWith("@iima.ac.in");
            promDateType = user1IsIIMA && user2IsIIMA ? "partner-iima" : "partner-outside";
          } else {
            // Fallback: check emails from match record
            const user1IsIIMA = (match.user1Email ?? "").endsWith("@iima.ac.in");
            const user2IsIIMA = (match.user2Email ?? "").endsWith("@iima.ac.in");
            promDateType = user1IsIIMA && user2IsIIMA ? "partner-iima" : "partner-outside";
          }
        }

        // Check if prom ask exists for this match (for active matches)
        const hasPromAsk = matchIdToPromAskStatus.has(match.id!) || false;

        matchesWithDetails.push({
          match,
          user1Profile,
          user2Profile,
          promDateType,
          hasPromAsk,
        });
      }

      // Add outside partner prom dates (no Match record, just UserProfile with partnerEmail)
      for (const profile of outsidePartnerProfiles) {
        // Check if this profile already has a Match record (shouldn't happen, but check anyway)
        const existingMatch = matchesWithDetails.find(
          (m) => m.match.user1Id === profile.id || m.match.user2Id === profile.id
        );
        if (!existingMatch) {
          // Create a virtual match entry for display purposes
          matchesWithDetails.push({
            match: {
              id: `outside-${profile.id}`,
              user1Id: profile.id!,
              user2Id: "", // No second user in Match record
              user1Email: profile.email ?? "",
              user2Email: profile.partnerEmail ?? "",
              status: "active",
              isPromDate: true,
              createdAt: profile.updatedAt ?? profile.createdAt ?? new Date().toISOString(),
            } as Schema["Match"]["type"],
            user1Profile: profile,
            user2Profile: undefined, // Partner is outside, no profile record
            promDateType: "partner-outside",
          });
        }
      }

      // Separate into prom dates and active matches
      const promDatesList = matchesWithDetails.filter((m) => m.match.isPromDate === true);
      const activeMatchesList = matchesWithDetails.filter(
        (m) => m.match.status === "active" && m.match.isPromDate !== true
      );

      // Sort by createdAt descending (newest first)
      const sortByDate = (a: MatchWithUserDetails, b: MatchWithUserDetails) => {
        const dateA = a.match.createdAt ? new Date(a.match.createdAt).getTime() : 0;
        const dateB = b.match.createdAt ? new Date(b.match.createdAt).getTime() : 0;
        return dateB - dateA;
      };

      promDatesList.sort(sortByDate);
      activeMatchesList.sort(sortByDate);

      setPromDates(promDatesList);
      setActiveMatches(activeMatchesList);
    } catch (err) {
      logError(err, { component: "AdminPromDates", operation: "fetchMatches" });
      setError(err instanceof Error ? err.message : "Failed to fetch matches");
    } finally {
      setLoading(false);
      setRefreshing(false);
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
      await fetchAllStats();
    } catch (err) {
      logError(err, { component: "AdminPromDates", operation: "computeDiscoveryScores" });
      setError(err instanceof Error ? err.message : "Failed to compute discovery scores");
    } finally {
      setComputingScores(false);
    }
  };

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const userProfile = await getUserProfileFromCognito();
        const userEmail = userProfile?.email?.toLowerCase().trim();
        
        if (!userEmail) {
          setIsAuthorized(false);
          setLoading(false);
          return;
        }

        const isAllowed = ALLOWED_ADMIN_EMAILS.some(
          (email) => email.toLowerCase().trim() === userEmail
        );

        if (!isAllowed) {
          logError(new Error("Unauthorized access attempt"), {
            component: "AdminPromDates",
            operation: "checkAccess",
            extra: { email: userEmail },
          });
          setIsAuthorized(false);
          setLoading(false);
          return;
        }

        setIsAuthorized(true);
        // Load data only if authorized
        setLoading(true);
        await Promise.all([fetchMatches(), fetchAllStats()]);
        setLoading(false);
      } catch (err) {
        logError(err, { component: "AdminPromDates", operation: "checkAccess" });
        setIsAuthorized(false);
        setLoading(false);
      }
    };

    checkAccess();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchMatches(), fetchAllStats()]);
    setRefreshing(false);
  };

  if (loading || isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="min-h-screen relative">
        <SparkleBackground />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="glass rounded-2xl p-8 max-w-md text-center">
            <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
            <p className="text-muted-foreground mb-6">
              You do not have permission to access this admin dashboard.
            </p>
            <Button onClick={() => navigate("/")} variant="outline">
              <Home className="w-4 h-4 mr-2" />
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <SparkleBackground />
      
      {/* Admin Navbar */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Admin Dashboard</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => navigate("/")} 
                variant="ghost" 
                size="sm"
                className="gap-2"
              >
                <Home className="w-4 h-4" />
                Home
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="relative z-10 container mx-auto px-4 py-8">
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Admin Monitoring Dashboard</h1>
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

          {stats && (
            <>
              {/* Overview Stats - Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard
                  icon={<Users className="w-5 h-5" />}
                  label="Total Users"
                  value={stats.totalUsers}
                  color="text-blue-600"
                />
                <StatCard
                  icon={<Heart className="w-5 h-5" />}
                  label="Total Matches"
                  value={stats.totalMatches}
                  color="text-pink-600"
                />
                <StatCard
                  icon={<MessageCircle className="w-5 h-5" />}
                  label="Total Conversations"
                  value={stats.totalConversations}
                  color="text-purple-600"
                />
                <StatCard
                  icon={<TrendingUp className="w-5 h-5" />}
                  label="Prom Dates"
                  value={stats.promDates}
                  color="text-green-600"
                />
              </div>

              {/* User Stats */}
              <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  User Statistics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Users</div>
                    <div className="text-lg font-semibold">{stats.totalUsers}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Completed Onboarding</div>
                    <div className="text-lg font-semibold text-green-600">{stats.usersCompletedOnboarding}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Looking Flow</div>
                    <div className="text-lg font-semibold text-blue-600">{stats.usersLookingFlow}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Partner Flow</div>
                    <div className="text-lg font-semibold text-purple-600">{stats.usersPartnerFlow}</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Users by Gender</div>
                    <div className="space-y-1">
                      {Object.entries(stats.usersByGender)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([gender, count]) => (
                          <div key={gender} className="flex justify-between text-sm">
                            <span>{gender}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Users by Cohort</div>
                    <div className="space-y-1">
                      {Object.entries(stats.usersByCohort)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([cohort, count]) => (
                          <div key={cohort} className="flex justify-between text-sm">
                            <span>{cohort}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Match Stats */}
              <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5" />
                  Match Statistics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Matches</div>
                    <div className="text-lg font-semibold">{stats.totalMatches}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Active Matches</div>
                    <div className="text-lg font-semibold text-green-600">{stats.activeMatches}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Prom Dates</div>
                    <div className="text-lg font-semibold text-primary">{stats.promDates}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Unmatched</div>
                    <div className="text-lg font-semibold text-gray-600">{stats.unmatchedMatches}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Matches Today</div>
                    <div className="text-lg font-semibold text-blue-600">{stats.matchesToday}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Matches This Week</div>
                    <div className="text-lg font-semibold text-blue-600">{stats.matchesThisWeek}</div>
                  </div>
                </div>
              </div>

              {/* Like Stats */}
              <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5" />
                  Like Statistics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Likes</div>
                    <div className="text-lg font-semibold">{stats.totalLikes}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Mutual Likes</div>
                    <div className="text-lg font-semibold text-pink-600">{stats.mutualLikes}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Likes Today</div>
                    <div className="text-lg font-semibold text-blue-600">{stats.likesToday}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Likes This Week</div>
                    <div className="text-lg font-semibold text-blue-600">{stats.likesThisWeek}</div>
                  </div>
                </div>
              </div>

              {/* Chat Stats */}
              <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Chat Statistics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Conversations</div>
                    <div className="text-lg font-semibold">{stats.totalConversations}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">With Messages</div>
                    <div className="text-lg font-semibold text-green-600">{stats.conversationsWithMessages}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total Messages</div>
                    <div className="text-lg font-semibold">{stats.totalMessages}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Avg Messages/Conv</div>
                    <div className="text-lg font-semibold">{stats.avgMessagesPerConversation}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Messages Today</div>
                    <div className="text-lg font-semibold text-blue-600">{stats.messagesToday}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Messages This Week</div>
                    <div className="text-lg font-semibold text-blue-600">{stats.messagesThisWeek}</div>
                  </div>
                </div>
              </div>

              {/* Match Request Stats */}
              <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <UserCheck className="w-5 h-5" />
                  Match Request Statistics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Requests</div>
                    <div className="text-lg font-semibold">{stats.totalMatchRequests}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Pending</div>
                    <div className="text-lg font-semibold text-orange-600">{stats.pendingMatchRequests}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Accepted</div>
                    <div className="text-lg font-semibold text-green-600">{stats.acceptedMatchRequests}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Declined/Withdrawn</div>
                    <div className="text-lg font-semibold text-red-600">{stats.declinedMatchRequests}</div>
                  </div>
                </div>
              </div>

              {/* Discovery Stats */}
              <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Discovery Statistics
                  </h2>
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <div className="text-muted-foreground">In Discovery</div>
                    <div className="text-lg font-semibold text-green-600">{stats.profilesInDiscovery}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Excluded</div>
                    <div className="text-lg font-semibold text-orange-600">{stats.profilesExcludedFromDiscovery}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">With Score</div>
                    <div className="text-lg font-semibold text-green-600">
                      {stats.discoveryScoreStats.profilesWithScore}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Without Score</div>
                    <div className="text-lg font-semibold text-orange-600">
                      {stats.discoveryScoreStats.profilesWithoutScore}
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-background/50 rounded-lg">
                  <div className="text-sm font-semibold mb-2">Why profiles don't have scores:</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">Onboarding Not Completed</div>
                      <div className="font-medium text-orange-600">
                        {stats.discoveryScoreStats.profilesWithoutScoreReasons.onboardingNotCompleted}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Excluded from Discovery</div>
                      <div className="font-medium text-red-600">
                        {stats.discoveryScoreStats.profilesWithoutScoreReasons.excludedFromDiscovery}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Partner Flow</div>
                      <div className="font-medium text-purple-600">
                        {stats.discoveryScoreStats.profilesWithoutScoreReasons.partnerFlow}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">No ID</div>
                      <div className="font-medium text-gray-600">
                        {stats.discoveryScoreStats.profilesWithoutScoreReasons.noId}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Last Score Update: {stats.discoveryScoreStats.lastScoreUpdate 
                    ? formatDate(stats.discoveryScoreStats.lastScoreUpdate)
                    : "Never"}
                </div>
              </div>
            </>
          )}

          {/* Prom Dates Table */}
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-4">Prom Dates</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Confirmed prom dates from all flows: Looking Flow (prom ask accepted), Partner Flow IIMA, and Partner Flow Non-IIMA
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User 1</TableHead>
                    <TableHead>User 2</TableHead>
                    <TableHead>IIMA Couple</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promDates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No prom dates found
                      </TableCell>
                    </TableRow>
                  ) : (
                    promDates.map((item, idx) => {
                      const user1Name = item.user1Profile?.name || item.match.user1Email || "Unknown";
                      const user1Email = item.match.user1Email || item.user1Profile?.email || "N/A";
                      // For outside partners, user2Profile is undefined, use partnerEmail/partnerName from user1Profile
                      const user2Name = item.promDateType === "partner-outside"
                        ? (item.user1Profile?.partnerName || item.match.user2Email || "Unknown")
                        : (item.user2Profile?.name || item.match.user2Email || "Unknown");
                      const user2Email = item.promDateType === "partner-outside"
                        ? (item.user1Profile?.partnerEmail || item.match.user2Email || "N/A")
                        : (item.match.user2Email || item.user2Profile?.email || "N/A");
                      const status = item.match.status || "active";
                      const isIIMA = isIIMACouple(item.match, item.user1Profile, item.user2Profile, item.promDateType);

                      return (
                        <TableRow key={item.match.id || idx}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{user1Name}</div>
                              <div className="text-sm text-muted-foreground">{user1Email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{user2Name}</div>
                              <div className="text-sm text-muted-foreground">{user2Email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isIIMA ? (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-700 dark:text-green-400">
                                Yes
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-gray-500/20 text-gray-700 dark:text-gray-400">
                                No
                              </span>
                            )}
                          </TableCell>
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
              Total prom dates: {promDates.length}
            </div>
          </div>

          {/* Active Matches Table */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Active Matches</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Active matches that are not yet confirmed as prom dates
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User 1</TableHead>
                    <TableHead>User 2</TableHead>
                    <TableHead>Prom Ask</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeMatches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No active matches found
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeMatches.map((item, idx) => {
                      const user1Name = item.user1Profile?.name || item.match.user1Email || "Unknown";
                      const user1Email = item.match.user1Email || item.user1Profile?.email || "N/A";
                      const user2Name = item.user2Profile?.name || item.match.user2Email || "Unknown";
                      const user2Email = item.match.user2Email || item.user2Profile?.email || "N/A";
                      const status = item.match.status || "active";
                      const hasPromAsk = item.hasPromAsk ?? false;

                      return (
                        <TableRow key={item.match.id || idx}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{user1Name}</div>
                              <div className="text-sm text-muted-foreground">{user1Email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{user2Name}</div>
                              <div className="text-sm text-muted-foreground">{user2Email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {hasPromAsk ? (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-700 dark:text-blue-400">
                                Asked
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-gray-500/20 text-gray-700 dark:text-gray-400">
                                Not Asked
                              </span>
                            )}
                          </TableCell>
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
              Total active matches: {activeMatches.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  return (
    <div className="p-4 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <div className={color || "text-muted-foreground"}>{icon}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
      <div className={`text-2xl font-bold ${color || ""}`}>{value.toLocaleString()}</div>
    </div>
  );
}
