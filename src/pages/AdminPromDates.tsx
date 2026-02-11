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
  const [matches, setMatches] = useState<MatchWithUserDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(false);
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

  // Advanced admin analytics for Prom dates and engagement.
  // Note: function name intentionally unique to avoid clashes with any earlier helpers.
  const computeAdvancedMetrics = (
    allProfiles: Schema["UserProfile"]["type"][],
    allMatches: Schema["Match"]["type"][],
    allLikes: Schema["Like"]["type"][],
    allConversations: Schema["Conversation"]["type"][],
    allMessages: Schema["Message"]["type"][],
    allMatchRequests: Schema["MatchRequest"]["type"][],
    allPromAsks: Schema["PromAskRequest"]["type"][],
    likedBy: Record<string, Set<string>>,
    mutualLikes: number,
    unmatchedMatches: number,
    usersByCohort: Record<string, number>
  ) => {
    try {
      // 1. Conversion Funnel Metrics
      const totalLikesCount = allLikes.length;
      const totalMatchesCount = allMatches.length;
      const promDatesCount = allMatches.filter(m => m.isPromDate === true).length;
      const likeToMatchRate = totalLikesCount > 0 ? (mutualLikes / totalLikesCount) * 100 : 0;
      const matchToPromDateRate = totalMatchesCount > 0 ? (promDatesCount / totalMatchesCount) * 100 : 0;
      
      const promAsksAccepted = allPromAsks.filter(a => a.status === "accepted").length;
      const promAsksTotal = allPromAsks.length;
      const promAskAcceptanceRate = promAsksTotal > 0 ? (promAsksAccepted / promAsksTotal) * 100 : 0;
      
      const matchRequestAccepted = allMatchRequests.filter(r => r.status === "accepted").length;
      const matchRequestTotal = allMatchRequests.length;
      const matchRequestAcceptanceRate = matchRequestTotal > 0 ? (matchRequestAccepted / matchRequestTotal) * 100 : 0;

      // 2. Engagement Metrics
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      
      // Active users: users who have updatedAt or createdAt in last 7 days, or sent messages
      const activeUserIds = new Set<string>();
      allProfiles.forEach(p => {
        if (p.updatedAt && new Date(p.updatedAt).getTime() >= sevenDaysAgo) activeUserIds.add(p.id!);
        if (p.createdAt && new Date(p.createdAt).getTime() >= sevenDaysAgo) activeUserIds.add(p.id!);
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allMessages.forEach((m: any) => {
        if (m.senderId) activeUserIds.add(m.senderId);
      });
      const activeUsersLast7Days = activeUserIds.size;

      // Daily active users (users active today)
      const dauIds = new Set<string>();
      allProfiles.forEach(p => {
        if (p.updatedAt && isToday(p.updatedAt)) dauIds.add(p.id!);
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allMessages.forEach((m: any) => {
        if (m.sentAt && isToday(m.sentAt) && m.senderId) dauIds.add(m.senderId);
      });
      const dailyActiveUsers = dauIds.size;

      // Weekly active users
      const wauIds = new Set<string>();
      allProfiles.forEach(p => {
        if (p.updatedAt && isThisWeek(p.updatedAt)) wauIds.add(p.id!);
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allMessages.forEach((m: any) => {
        if (m.sentAt && isThisWeek(m.sentAt) && m.senderId) wauIds.add(m.senderId);
      });
      const weeklyActiveUsers = wauIds.size;

      const usersWithPhotos = allProfiles.filter(p => p.profilePicKey && p.profilePicKey.trim() !== "").length;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const usersWhoSentMessages = new Set(allMessages.map((m: any) => m.senderId).filter(Boolean)).size;

      // 3. Time-based Metrics
      // Calculate average time from first like to match
      const matchTimes: number[] = [];
      allMatches.forEach(match => {
        if (!match.createdAt) return;
        const matchTime = new Date(match.createdAt).getTime();
        const user1Id = match.user1Id;
        const user2Id = match.user2Id;
        
        // Find first like between these two users
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const relevantLikes = allLikes.filter((l: any) => 
          (l.fromUserId === user1Id && l.toUserId === user2Id) ||
          (l.fromUserId === user2Id && l.toUserId === user1Id)
        );
        
        if (relevantLikes.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const firstLikeTime = Math.min(...relevantLikes.map((l: any) => 
            l.createdAt ? new Date(l.createdAt).getTime() : matchTime
          ));
          const hoursDiff = (matchTime - firstLikeTime) / (1000 * 60 * 60);
          if (hoursDiff >= 0 && hoursDiff < 10000) { // Sanity check: less than ~1 year
            matchTimes.push(hoursDiff);
          }
        }
      });
      const avgTimeToMatchHours = matchTimes.length > 0 
        ? matchTimes.reduce((a, b) => a + b, 0) / matchTimes.length 
        : 0;

      // Calculate average time from match to prom date
      const promDateTimes: number[] = [];
      allMatches.filter(m => m.isPromDate === true).forEach(promMatch => {
        if (!promMatch.createdAt) return;
        const promDateTime = new Date(promMatch.createdAt).getTime();
        
        // Find when the match was created (before prom date confirmation)
        // For looking flow, check prom ask acceptance time
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const promAsk = allPromAsks.find((a: any) => 
          a.matchId === promMatch.id && a.status === "accepted"
        );
        
        if (promAsk && promAsk.createdAt) {
          const matchCreatedTime = new Date(promAsk.createdAt).getTime();
          const hoursDiff = (promDateTime - matchCreatedTime) / (1000 * 60 * 60);
          if (hoursDiff >= 0 && hoursDiff < 10000) {
            promDateTimes.push(hoursDiff);
          }
        } else {
          // For partner flow, use match creation time
          const matchCreatedTime = new Date(promMatch.createdAt).getTime();
          // Assume prom date confirmed immediately for partner flow
          promDateTimes.push(0);
        }
      });
      const avgTimeToPromDateHours = promDateTimes.length > 0
        ? promDateTimes.reduce((a, b) => a + b, 0) / promDateTimes.length
        : 0;

      const newUsersToday = allProfiles.filter(p => isToday(p.createdAt)).length;
      const newUsersThisWeek = allProfiles.filter(p => isThisWeek(p.createdAt)).length;
      
      // Recent activity: users active in last 24 hours
      const recentActivityIds = new Set<string>();
      allProfiles.forEach(p => {
        if (p.updatedAt && isLast24Hours(p.updatedAt)) recentActivityIds.add(p.id!);
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allMessages.forEach((m: any) => {
        if (m.sentAt && isLast24Hours(m.sentAt) && m.senderId) recentActivityIds.add(m.senderId);
      });
      const recentActivity24h = recentActivityIds.size;

      // 4. Quality Metrics
      const matchesWithConversations = allMatches.filter(m => {
        const conv = allConversations.find(c => c.matchId === m.id);
        return conv && allMessages.some(msg => msg.conversationId === conv.id);
      }).length;
      const matchesWithConversationsPercent = totalMatchesCount > 0 
        ? (matchesWithConversations / totalMatchesCount) * 100 
        : 0;

      // Prom dates from looking flow (have accepted prom ask)
      const lookingFlowPromDateIds = new Set(
        allPromAsks
          .filter(a => a.status === "accepted" && a.matchId)
          .map(a => a.matchId!)
      );
      const promDatesFromLookingFlow = allMatches.filter(m => 
        m.isPromDate === true && lookingFlowPromDateIds.has(m.id!)
      ).length;

      const unmatchRate = totalMatchesCount > 0 
        ? (unmatchedMatches / totalMatchesCount) * 100 
        : 0;

      // Profile completeness: count filled fields
      const completenessScores: number[] = [];
      allProfiles.forEach(p => {
        const fields = [
          "bio", "cohort", "gender", "intention", "hometown",
          "alcoholPreference", "smokingPreference", "foodPreference", 
          "favouritePlace", "teaOrCoffee", "mountainOrBeach",
          "profilePicKey"
        ];
        let filled = 0;
        fields.forEach(field => {
          const value = (p as any)[field];
          if (value != null && typeof value === "string" && value.trim() !== "") filled++;
        });
        completenessScores.push(filled / fields.length);
      });
      const avgProfileCompleteness = completenessScores.length > 0
        ? (completenessScores.reduce((a, b) => a + b, 0) / completenessScores.length) * 100
        : 0;

      // 6. Cohort-specific Metrics
      // Create a map of userId to cohort for quick lookup
      const userIdToCohort: Record<string, string> = {};
      allProfiles.forEach(p => {
        if (p.id) {
          userIdToCohort[p.id] = p.cohort || "Unknown";
        }
      });

      const matchesByCohort: Record<string, number> = {};
      const promDatesByCohort: Record<string, number> = {};
      const likesByCohort: Record<string, number> = {};
      
      allMatches.forEach(m => {
        // Get cohorts from both users in the match
        const user1Cohort = m.user1Id ? (userIdToCohort[m.user1Id] || "Unknown") : "Unknown";
        const user2Cohort = m.user2Id ? (userIdToCohort[m.user2Id] || "Unknown") : "Unknown";
        
        // Count match for both cohorts
        matchesByCohort[user1Cohort] = (matchesByCohort[user1Cohort] || 0) + 1;
        if (user1Cohort !== user2Cohort) {
          matchesByCohort[user2Cohort] = (matchesByCohort[user2Cohort] || 0) + 1;
        }
        
        if (m.isPromDate) {
          promDatesByCohort[user1Cohort] = (promDatesByCohort[user1Cohort] || 0) + 1;
          if (user1Cohort !== user2Cohort) {
            promDatesByCohort[user2Cohort] = (promDatesByCohort[user2Cohort] || 0) + 1;
          }
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allLikes.forEach((l: any) => {
        const fromCohort = l.fromUserId ? (userIdToCohort[l.fromUserId] || "Unknown") : "Unknown";
        likesByCohort[fromCohort] = (likesByCohort[fromCohort] || 0) + 1;
      });

      // Most active cohorts
      const mostActiveCohorts: Array<{ cohort: string; likes: number; matches: number }> = [];
      Object.entries(usersByCohort).forEach(([cohort, userCount]) => {
        if (cohort !== "Unknown") {
          mostActiveCohorts.push({
            cohort,
            likes: likesByCohort[cohort] || 0,
            matches: matchesByCohort[cohort] || 0,
          });
        }
      });
      mostActiveCohorts.sort((a, b) => (b.likes + b.matches) - (a.likes + a.matches));

      // 7. Prom Ask Metrics
      const totalPromAsksSent = allPromAsks.length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const promAsksPending = allPromAsks.filter((a: any) => a.status === "pending").length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const promAsksDeclined = allPromAsks.filter((a: any) => a.status === "declined").length;

      // 9. Discovery Feed Metrics
      const scoresWithValues = allProfiles
        .map(p => p.discoveryScore)
        .filter((s): s is number => s != null && typeof s === "number");
      const avgDiscoveryScore = scoresWithValues.length > 0
        ? scoresWithValues.reduce((a, b) => a + b, 0) / scoresWithValues.length
        : 0;

      const discoveryScoreDistribution = {
        high: scoresWithValues.filter(s => s > 0.7).length,
        medium: scoresWithValues.filter(s => s >= 0.4 && s <= 0.7).length,
        low: scoresWithValues.filter(s => s < 0.4).length,
      };

      // Profiles never shown (simplified - would need exposure tracking)
      const profilesNeverShown = profilesInDiscovery - scoresWithValues.length;

      // 10. Flow Distribution Metrics
      const usersByFlowType = {
        looking: usersLookingFlow,
        partnerIIMA: allProfiles.filter(p => {
          const hasPartner = (p.partnerStatus ?? "").includes("Already found");
          const partnerEmail = (p.partnerEmail ?? "").trim();
          return hasPartner && partnerEmail.endsWith("@iima.ac.in");
        }).length,
        partnerOutside: allProfiles.filter(p => {
          const hasPartner = (p.partnerStatus ?? "").includes("Already found");
          const partnerEmail = (p.partnerEmail ?? "").trim();
          return hasPartner && partnerEmail !== "" && !partnerEmail.endsWith("@iima.ac.in");
        }).length,
      };

      // Flow changes: users who have updatedAt significantly after createdAt
      let flowChanges = 0;
      allProfiles.forEach(p => {
        if (p.createdAt && p.updatedAt) {
          const created = new Date(p.createdAt).getTime();
          const updated = new Date(p.updatedAt).getTime();
          // If updated more than 1 hour after creation, likely a flow change
          if (updated > created + 60 * 60 * 1000) {
            flowChanges++;
          }
        }
      });

      const partnerInviteSuccessRate = matchRequestTotal > 0
        ? (matchRequestAccepted / matchRequestTotal) * 100
        : 0;

      setAdvancedMetrics({
        likeToMatchRate,
        matchToPromDateRate,
        promAskAcceptanceRate,
        matchRequestAcceptanceRate,
        activeUsersLast7Days,
        dailyActiveUsers,
        weeklyActiveUsers,
        usersWithPhotos,
        usersWhoSentMessages,
        avgTimeToMatchHours,
        avgTimeToPromDateHours,
        newUsersToday,
        newUsersThisWeek,
        recentActivity24h,
        matchesWithConversations,
        matchesWithConversationsPercent,
        promDatesFromLookingFlow,
        unmatchRate,
        avgProfileCompleteness,
        matchesByCohort,
        promDatesByCohort,
        mostActiveCohorts: mostActiveCohorts.slice(0, 5),
        totalPromAsksSent,
        promAsksPending,
        promAsksAccepted,
        promAsksDeclined,
        avgDiscoveryScore,
        discoveryScoreDistribution,
        profilesNeverShown,
        usersByFlowType,
        flowChanges,
        partnerInviteSuccessRate,
      });
    } catch (err) {
      logError(err, { component: "AdminPromDates", operation: "computeAdvancedMetrics" });
    }
  };

  // Helper function to fetch all records with pagination (larger page size = fewer round-trips)
  const fetchAllWithPagination = async <T,>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listFn: (opts?: any) => Promise<{ data?: T[]; nextToken?: string }>,
    opts?: { authMode?: "apiKey" }
  ): Promise<T[]> => {
    const all: T[] = [];
    let nextToken: string | undefined;
    const limit = 500;
    do {
      const res = await listFn({ nextToken, limit, ...opts });
      if (res.data) {
        all.push(...res.data);
      }
      nextToken = res.nextToken ?? undefined;
    } while (nextToken);
    return all;
  };

  const fetchMatches = async () => {
    setMatchesLoading(true);
    try {
      setError(null);
      const opts = !GOOGLE_LOGIN_CHECK ? { authMode: "apiKey" as const } : undefined;

      // Fetch all matches (paginated, larger pages)
      const allMatches: Schema["Match"]["type"][] = [];
      let nextToken: string | undefined;
      do {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await (client.models.Match as any).list({ nextToken, limit: 500 }, opts);
        if (res.data) {
          allMatches.push(...(res.data as Schema["Match"]["type"][]));
        }
        nextToken = res.nextToken ?? undefined;
      } while (nextToken);

      logInfo("Fetched matches", { component: "AdminPromDates", operation: "fetchMatches", extra: { count: allMatches.length } });

      const matchesToProcess = allMatches.slice(0, 100);
      const uniqueUserIds = new Set<string>();
      matchesToProcess.forEach((m) => {
        if (m.user1Id) uniqueUserIds.add(m.user1Id);
        if (m.user2Id) uniqueUserIds.add(m.user2Id);
      });

      // Fetch all profiles in parallel batches (avoids 200 sequential getProfileById calls)
      const BATCH_SIZE = 25;
      const userIds = Array.from(uniqueUserIds);
      const profileMap = new Map<string, Schema["UserProfile"]["type"]>();
      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const batch = userIds.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((id) => getUserProfileById(id, opts).then((r) => ({ id, data: r.data })))
        );
        results.forEach((r) => {
          if (r.status === "fulfilled" && r.value.data) {
            profileMap.set(r.value.id, r.value.data);
          }
        });
      }

      const matchesWithDetails: MatchWithUserDetails[] = matchesToProcess.map((match) => ({
        match,
        user1Profile: match.user1Id ? profileMap.get(match.user1Id) : undefined,
        user2Profile: match.user2Id ? profileMap.get(match.user2Id) : undefined,
      }));

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
      setMatchesLoading(false);
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
        setLoading(true);
        setMatchesLoading(true);
        try {
          // Load stats first — dashboard becomes visible as soon as stats are ready
          await fetchAllStats();
          setLoading(false);
          // Load matches in background (table shows spinner until done)
          fetchMatches();
        } catch (err) {
          setLoading(false);
          setMatchesLoading(false);
          throw err;
        }
      } catch (err) {
        logError(err, { component: "AdminPromDates", operation: "checkAccess" });
        setIsAuthorized(false);
        setLoading(false);
        setMatchesLoading(false);
      }
    };

    checkAccess();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setMatchesLoading(true);
    try {
      await Promise.all([fetchAllStats(), fetchMatches()]);
    } finally {
      setRefreshing(false);
    }
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

          {/* Matches Table — loads in background after stats */}
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-4">All Prom Dates (Latest 100)</h2>
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
                  {matchesLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Loading matches…
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : matches.length === 0 ? (
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
              {matchesLoading ? "Loading matches…" : `Showing ${matches.length} matches (latest 100)`}
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
