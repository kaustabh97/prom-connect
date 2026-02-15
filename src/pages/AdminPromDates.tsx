import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { getUserProfileById } from "@/lib/dataAccess";
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
import { Loader2, RefreshCw, Users, Heart, MessageCircle, TrendingUp, UserCheck, Home, Shield, AlertTriangle, BarChart3, Table2, LayoutDashboard, Play, Download, CheckCircle2, Zap } from "lucide-react";
import SparkleBackground from "@/components/SparkleBackground";
import { useNavigate } from "react-router-dom";
import { getUserProfileFromCognito } from "@/utils/auth";
import { GOOGLE_LOGIN_CHECK, DISCOVERY_HIDDEN_PROFILE_EMAILS } from "@/config";

const client = generateClient<Schema>();

// Admin dashboard access: same list as profiles hidden from discovery
const ALLOWED_ADMIN_EMAILS = DISCOVERY_HIDDEN_PROFILE_EMAILS;

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

type AdvancedMetrics = {
  // Conversion Funnel Metrics
  likeToMatchRate: number; // %
  matchToPromDateRate: number; // %
  promAskAcceptanceRate: number; // %
  matchRequestAcceptanceRate: number; // %
  
  // Engagement Metrics
  activeUsersLast7Days: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  usersWithPhotos: number;
  usersWhoSentMessages: number;
  
  // Time-based Metrics
  avgTimeToMatchHours: number; // Average hours from first like to match
  avgTimeToPromDateHours: number; // Average hours from match to prom date
  newUsersToday: number;
  newUsersThisWeek: number;
  recentActivity24h: number; // Users active in last 24 hours
  
  // Quality Metrics
  matchesWithConversations: number;
  matchesWithConversationsPercent: number;
  promDatesFromLookingFlow: number;
  unmatchRate: number; // %
  avgProfileCompleteness: number; // %
  
  // Cohort-specific Metrics
  matchesByCohort: Record<string, number>;
  promDatesByCohort: Record<string, number>;
  mostActiveCohorts: Array<{ cohort: string; likes: number; matches: number }>;
  
  // Prom Ask Metrics
  totalPromAsksSent: number;
  promAsksPending: number;
  promAsksAccepted: number;
  promAsksDeclined: number;
  
  // Discovery Feed Metrics
  avgDiscoveryScore: number;
  discoveryScoreDistribution: {
    high: number; // > 0.7
    medium: number; // 0.4 - 0.7
    low: number; // < 0.4
  };
  profilesNeverShown: number;
  
  // Flow Distribution Metrics
  usersByFlowType: {
    looking: number;
    partnerIIMA: number;
    partnerOutside: number;
  };
  flowChanges: number; // Users who changed flows
  partnerInviteSuccessRate: number; // %
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

const isLast7Days = (dateString?: string | null): boolean => {
  if (!dateString) return false;
  try {
    const date = new Date(dateString);
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return date >= sevenDaysAgo;
  } catch {
    return false;
  }
};

const isLast24Hours = (dateString?: string | null): boolean => {
  if (!dateString) return false;
  try {
    const date = new Date(dateString);
    const today = new Date();
    const oneDayAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    return date >= oneDayAgo;
  } catch {
    return false;
  }
};

type TabType = "overview" | "tables" | "metrics";

export default function AdminPromDates() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [promDates, setPromDates] = useState<MatchWithUserDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [advancedMetrics, setAdvancedMetrics] = useState<AdvancedMetrics | null>(null);
  const [metricsLoadingSections, setMetricsLoadingSections] = useState<Set<string>>(new Set());
  const [computingScores, setComputingScores] = useState(false);
  const [ensuringMatches, setEnsuringMatches] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [healthCheckResult, setHealthCheckResult] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  const fetchAllStats = async () => {
    try {
      setError(null);
      console.log("[AdminPromDates] Starting fetchAllStats...");
      const opts = !GOOGLE_LOGIN_CHECK ? { authMode: "apiKey" as const } : undefined;

      // Fetch all data with pagination
      console.log("[AdminPromDates] Fetching data with pagination...");
      const [allProfiles, allMatches, allLikes, allConversations, allMessages, allMatchRequests, allPromAsks, allReports] = await Promise.all([
        fetchAllWithPagination(client.models.UserProfile.list.bind(client.models.UserProfile), opts),
        fetchAllWithPagination((client.models.Match as any).list.bind(client.models.Match), opts),
        fetchAllWithPagination((client.models.Like as any).list.bind(client.models.Like), opts),
        fetchAllWithPagination((client.models.Conversation as any).list.bind(client.models.Conversation), opts),
        fetchAllWithPagination((client.models.Message as any).list.bind(client.models.Message), opts),
        fetchAllWithPagination((client.models.MatchRequest as any).list.bind(client.models.MatchRequest), opts),
        fetchAllWithPagination((client.models.PromAskRequest as any).list.bind(client.models.PromAskRequest), opts),
        fetchAllWithPagination((client.models.Report as any).list.bind(client.models.Report), opts),
      ]);
      console.log("[AdminPromDates] Data fetched:", {
        profiles: allProfiles.length,
        matches: allMatches.length,
        likes: allLikes.length,
        conversations: allConversations.length,
        messages: allMessages.length,
      });

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
      const activeMatchesCount = allMatches.filter(m => m.status === "active").length;
      const promDatesCount = allMatches.filter(m => m.isPromDate === true).length;
      const unmatchedMatches = allMatches.filter(m => m.status === "unmatched").length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matchesToday = allMatches.filter((m: any) => isToday(m.createdAt)).length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matchesThisWeek = allMatches.filter((m: any) => isThisWeek(m.createdAt)).length;

      // Calculate like stats
      const totalLikes = allLikes.length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const likesToday = allLikes.filter((l: any) => isToday(l.createdAt)).length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const likesThisWeek = allLikes.filter((l: any) => isThisWeek(l.createdAt)).length;
      
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conversationsWithMessages = new Set(allMessages.map((m: any) => m.conversationId).filter(Boolean)).size;
      const totalMessages = allMessages.length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messagesToday = allMessages.filter((m: any) => isToday(m.sentAt)).length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messagesThisWeek = allMessages.filter((m: any) => isThisWeek(m.sentAt)).length;
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

      const statsData = {
        totalUsers,
        usersLookingFlow,
        usersPartnerFlow,
        usersCompletedOnboarding,
        usersByGender,
        usersByCohort,
        totalMatches,
        activeMatches: activeMatchesCount,
        promDates: promDatesCount,
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
      };
      
      setStats(statsData);

      // Calculate Advanced Metrics (incremental sections)
      calculateAdvancedMetrics(
        allProfiles,
        allMatches,
        allLikes,
        allConversations,
        allMessages,
        allMatchRequests,
        allPromAsks,
        likedBy,
        mutualLikes,
        unmatchedMatches,
        usersByCohort,
        promDatesCount,
        usersLookingFlow,
        profilesInDiscovery
      );

      console.log("[AdminPromDates] Stats set successfully:", {
        totalUsers: statsData.totalUsers,
        totalMatches: statsData.totalMatches,
      });
      logInfo("Fetched all stats", { component: "AdminPromDates", operation: "fetchAllStats", extra: { totalUsers: statsData.totalUsers } });
    } catch (err) {
      logError(err, { component: "AdminPromDates", operation: "fetchAllStats" });
      setError(err instanceof Error ? err.message : "Failed to fetch stats");
      // Ensure stats is set to null on error so loading state shows
      setStats(null);
      setAdvancedMetrics(null);
    }
  };

  const calculateAdvancedMetrics = (
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
    usersByCohort: Record<string, number>,
    promDatesCount: number,
    usersLookingFlow: number,
    profilesInDiscovery: number
  ) => {
    // Initialize empty metrics object
    const initialMetrics: AdvancedMetrics = {
      likeToMatchRate: 0,
      matchToPromDateRate: 0,
      promAskAcceptanceRate: 0,
      matchRequestAcceptanceRate: 0,
      activeUsersLast7Days: 0,
      dailyActiveUsers: 0,
      weeklyActiveUsers: 0,
      usersWithPhotos: 0,
      usersWhoSentMessages: 0,
      avgTimeToMatchHours: 0,
      avgTimeToPromDateHours: 0,
      newUsersToday: 0,
      newUsersThisWeek: 0,
      recentActivity24h: 0,
      matchesWithConversations: 0,
      matchesWithConversationsPercent: 0,
      promDatesFromLookingFlow: 0,
      unmatchRate: 0,
      avgProfileCompleteness: 0,
      matchesByCohort: {},
      promDatesByCohort: {},
      mostActiveCohorts: [],
      totalPromAsksSent: 0,
      promAsksPending: 0,
      promAsksAccepted: 0,
      promAsksDeclined: 0,
      avgDiscoveryScore: 0,
      discoveryScoreDistribution: { high: 0, medium: 0, low: 0 },
      profilesNeverShown: 0,
      usersByFlowType: { looking: 0, partnerIIMA: 0, partnerOutside: 0 },
      flowChanges: 0,
      partnerInviteSuccessRate: 0,
    };
    
    setAdvancedMetrics(initialMetrics);
    
    // Calculate sections incrementally using setTimeout to avoid blocking
    let sectionDelay = 0;
    const calculateSection = (sectionName: string, calculateFn: () => Partial<AdvancedMetrics>) => {
      const currentDelay = sectionDelay;
      sectionDelay += 100; // Stagger sections by 100ms each
      
      setMetricsLoadingSections(prev => new Set(prev).add(sectionName));
      
      setTimeout(() => {
        try {
          const sectionMetrics = calculateFn();
          setAdvancedMetrics(prev => prev ? { ...prev, ...sectionMetrics } : initialMetrics);
          setMetricsLoadingSections(prev => {
            const next = new Set(prev);
            next.delete(sectionName);
            return next;
          });
        } catch (err) {
          logError(err, { component: "AdminPromDates", operation: `calculateSection-${sectionName}` });
          setMetricsLoadingSections(prev => {
            const next = new Set(prev);
            next.delete(sectionName);
            return next;
          });
        }
      }, currentDelay);
    };

    try {
      // Section 1: Conversion Funnel Metrics (fast - simple calculations)
      calculateSection("conversion", () => {
        const totalLikesCount = allLikes.length;
        const totalMatchesCount = allMatches.length;
        const likeToMatchRate = totalLikesCount > 0 ? (mutualLikes / totalLikesCount) * 100 : 0;
        const matchToPromDateRate = totalMatchesCount > 0 ? (promDatesCount / totalMatchesCount) * 100 : 0;
        const matchRequestAccepted = allMatchRequests.filter(r => r.status === "accepted").length;
        const matchRequestTotal = allMatchRequests.length;
        const matchRequestAcceptanceRate = matchRequestTotal > 0 ? (matchRequestAccepted / matchRequestTotal) * 100 : 0;
        
        return {
          likeToMatchRate,
          matchToPromDateRate,
          matchRequestAcceptanceRate,
        };
      });

      // Section 2: Engagement Metrics (medium - requires iteration)
      calculateSection("engagement", () => {
        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        
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

        const dauIds = new Set<string>();
        allProfiles.forEach(p => {
          if (p.updatedAt && isToday(p.updatedAt)) dauIds.add(p.id!);
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        allMessages.forEach((m: any) => {
          if (m.sentAt && isToday(m.sentAt) && m.senderId) dauIds.add(m.senderId);
        });
        const dailyActiveUsers = dauIds.size;

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
        
        return {
          activeUsersLast7Days,
          dailyActiveUsers,
          weeklyActiveUsers,
          usersWithPhotos,
          usersWhoSentMessages,
        };
      });

      // Section 3: Time-based Metrics (slow - complex calculations)
      calculateSection("timebased", () => {
        const matchTimes: number[] = [];
        allMatches.forEach(match => {
          if (!match.createdAt) return;
          const matchTime = new Date(match.createdAt).getTime();
          const user1Id = match.user1Id;
          const user2Id = match.user2Id;
          
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
            if (hoursDiff >= 0 && hoursDiff < 10000) {
              matchTimes.push(hoursDiff);
            }
          }
        });
        const avgTimeToMatchHours = matchTimes.length > 0 
          ? matchTimes.reduce((a, b) => a + b, 0) / matchTimes.length 
          : 0;

        const promDateTimes: number[] = [];
        allMatches.filter(m => m.isPromDate === true).forEach(promMatch => {
          if (!promMatch.createdAt) return;
          const promDateTime = new Date(promMatch.createdAt).getTime();
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
            promDateTimes.push(0);
          }
        });
        const avgTimeToPromDateHours = promDateTimes.length > 0
          ? promDateTimes.reduce((a, b) => a + b, 0) / promDateTimes.length
          : 0;

        const newUsersToday = allProfiles.filter(p => isToday(p.createdAt)).length;
        const newUsersThisWeek = allProfiles.filter(p => isThisWeek(p.createdAt)).length;
        
        const recentActivityIds = new Set<string>();
        allProfiles.forEach(p => {
          if (p.updatedAt && isLast24Hours(p.updatedAt)) recentActivityIds.add(p.id!);
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        allMessages.forEach((m: any) => {
          if (m.sentAt && isLast24Hours(m.sentAt) && m.senderId) recentActivityIds.add(m.senderId);
        });
        const recentActivity24h = recentActivityIds.size;
        
        return {
          avgTimeToMatchHours,
          avgTimeToPromDateHours,
          newUsersToday,
          newUsersThisWeek,
          recentActivity24h,
        };
      });

      // Section 4: Quality Metrics (medium - requires iteration)
      calculateSection("quality", () => {
        const totalMatchesCount = allMatches.length;
        const matchesWithConversations = allMatches.filter(m => {
          const conv = allConversations.find(c => c.matchId === m.id);
          return conv && allMessages.some(msg => msg.conversationId === conv.id);
        }).length;
        const matchesWithConversationsPercent = totalMatchesCount > 0 
          ? (matchesWithConversations / totalMatchesCount) * 100 
          : 0;

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
        
        return {
          matchesWithConversations,
          matchesWithConversationsPercent,
          promDatesFromLookingFlow,
          unmatchRate,
          avgProfileCompleteness,
        };
      });

      // Section 6: Cohort-specific Metrics (slow - requires multiple iterations)
      calculateSection("cohort", () => {
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
          const user1Cohort = m.user1Id ? (userIdToCohort[m.user1Id] || "Unknown") : "Unknown";
          const user2Cohort = m.user2Id ? (userIdToCohort[m.user2Id] || "Unknown") : "Unknown";
          
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
        
        return {
          matchesByCohort,
          promDatesByCohort,
          mostActiveCohorts: mostActiveCohorts.slice(0, 5),
        };
      });

      // Section 7: Prom Ask Metrics (fast - simple calculations)
      calculateSection("promask", () => {
        const totalPromAsksSent = allPromAsks.length;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const promAsksPending = allPromAsks.filter((a: any) => a.status === "pending").length;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const promAsksAccepted = allPromAsks.filter((a: any) => a.status === "accepted").length;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const promAsksDeclined = allPromAsks.filter((a: any) => a.status === "declined").length;
        const promAskAcceptanceRate = totalPromAsksSent > 0 ? (promAsksAccepted / totalPromAsksSent) * 100 : 0;
        
        return {
          totalPromAsksSent,
          promAsksPending,
          promAsksAccepted,
          promAsksDeclined,
          promAskAcceptanceRate,
        };
      });

      // Section 9: Discovery Feed Metrics (fast - simple calculations)
      calculateSection("discovery", () => {
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

        const profilesNeverShown = profilesInDiscovery - scoresWithValues.length;
        
        return {
          avgDiscoveryScore,
          discoveryScoreDistribution,
          profilesNeverShown,
        };
      });

      // Section 10: Flow Distribution Metrics (medium - requires iteration)
      calculateSection("flow", () => {
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

        let flowChanges = 0;
        allProfiles.forEach(p => {
          if (p.createdAt && p.updatedAt) {
            const created = new Date(p.createdAt).getTime();
            const updated = new Date(p.updatedAt).getTime();
            if (updated > created + 60 * 60 * 1000) {
              flowChanges++;
            }
          }
        });

        const matchRequestAccepted = allMatchRequests.filter(r => r.status === "accepted").length;
        const matchRequestTotal = allMatchRequests.length;
        const partnerInviteSuccessRate = matchRequestTotal > 0
          ? (matchRequestAccepted / matchRequestTotal) * 100
          : 0;
        
        return {
          usersByFlowType,
          flowChanges,
          partnerInviteSuccessRate,
        };
      });
    } catch (err) {
      logError(err, { component: "AdminPromDates", operation: "calculateAdvancedMetrics" });
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

      // Fetch all matches with pagination
      const allMatches = await fetchAllWithPagination(
        (client.models.Match as any).list.bind(client.models.Match),
        opts
      ) as Schema["Match"]["type"][];

      // Fetch all MatchRequests to identify partner flow (IIMA) prom dates (with pagination)
      const allMatchRequests = await fetchAllWithPagination(
        (client.models.MatchRequest as any).list.bind(client.models.MatchRequest),
        opts
      ) as Schema["MatchRequest"]["type"][];

      // Fetch all PromAskRequests to identify looking-flow prom dates (with pagination)
      const allPromAsks = await fetchAllWithPagination(
        (client.models.PromAskRequest as any).list.bind(client.models.PromAskRequest),
        opts
      ) as Schema["PromAskRequest"]["type"][];

      // Create a set of matchIds that have accepted PromAskRequests (looking-flow prom dates)
      // These are matches where prom date was confirmed via PromAskRequest (looking flow)
      const lookingFlowPromDateMatchIds = new Set(
        allPromAsks
          .filter((ask) => ask.status === "accepted" && ask.matchId)
          .map((ask) => ask.matchId!)
      );

      // Create a set of user pairs that have accepted MatchRequests (partner flow IIMA prom dates)
      // MatchRequest creates Match with isPromDate=true, so we identify these by checking
      // if both users from an accepted MatchRequest match the Match's user1Id/user2Id
      const partnerFlowPromDatePairs = new Set<string>();
      allMatchRequests
        .filter((req) => req.status === "accepted" && req.fromUserId && req.toUserId)
        .forEach((req) => {
          // Create a normalized pair key (sorted to handle both directions)
          const pair = [req.fromUserId!, req.toUserId!].sort().join("|");
          partnerFlowPromDatePairs.add(pair);
        });

      // Create a map of matchIds to prom ask status (for active matches table)
      const matchIdToPromAskStatus = new Map<string, boolean>();
      allPromAsks.forEach((ask) => {
        if (ask.matchId) {
          matchIdToPromAskStatus.set(ask.matchId, true); // Any prom ask (pending/accepted/declined) means "Asked"
        }
      });

      // Fetch all UserProfiles to find partner flow non-IIMA prom dates (have partnerEmail but no Match) (with pagination)
      const allProfiles = await fetchAllWithPagination(
        client.models.UserProfile.list.bind(client.models.UserProfile),
        opts
      ) as Schema["UserProfile"]["type"][];

      // Non-IIMA partner flow prom dates: no Match record. Either they entered partner name only (bio "Partner: Name")
      // or non-IIMA partnerEmail. Include profiles that have partner in bio or non-IIMA partnerEmail, and are not IIMA.
      const outsidePartnerProfiles = allProfiles.filter((p) => {
        const partnerEmail = (p.partnerEmail ?? "").trim();
        const hasNonIIMAPartnerEmail = partnerEmail !== "" && !partnerEmail.endsWith("@iima.ac.in");
        const bioStartsPartner = typeof p.bio === "string" && p.bio.trim().startsWith("Partner:");
        const hasPartnerStatus = (p.partnerStatus ?? "").includes("Already found");
        return (
          (hasNonIIMAPartnerEmail || bioStartsPartner) &&
          !partnerEmail.endsWith("@iima.ac.in") &&
          (hasPartnerStatus || bioStartsPartner)
        );
      });

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
          // Priority 1: Check if this match has an accepted PromAskRequest (looking flow)
          if (lookingFlowPromDateMatchIds.has(match.id!)) {
            promDateType = "looking-flow";
          } else if (user1Id && user2Id) {
            // Priority 2: Check if this match was created from an accepted MatchRequest (partner flow IIMA)
            const matchPair = [user1Id, user2Id].sort().join("|");
            if (partnerFlowPromDatePairs.has(matchPair)) {
              promDateType = "partner-iima";
            } else if (user1Profile && user2Profile) {
              // Priority 3: Check if both are IIMA (fallback for partner flow IIMA)
              const user1IsIIMA = (user1Profile.email ?? "").endsWith("@iima.ac.in");
              const user2IsIIMA = (user2Profile.email ?? "").endsWith("@iima.ac.in");
              promDateType = user1IsIIMA && user2IsIIMA ? "partner-iima" : "partner-outside";
            } else {
              // Fallback: check emails from match record
              const user1IsIIMA = (match.user1Email ?? "").endsWith("@iima.ac.in");
              const user2IsIIMA = (match.user2Email ?? "").endsWith("@iima.ac.in");
              promDateType = user1IsIIMA && user2IsIIMA ? "partner-iima" : "partner-outside";
            }
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

      // Add outside partner prom dates (no Match record). Partner name from bio "Partner: Name" or partnerEmail.
      for (const profile of outsidePartnerProfiles) {
        const existingMatch = matchesWithDetails.find(
          (m) => m.match.user1Id === profile.id || m.match.user2Id === profile.id
        );
        if (!existingMatch) {
          const partnerNameFromBio = typeof profile.bio === "string"
            ? profile.bio.trim().match(/^Partner:\s*(.+)/)?.[1]?.trim()
            : undefined;
          const partnerDisplay = partnerNameFromBio || (profile.partnerEmail ?? "").trim() || "Partner";
          matchesWithDetails.push({
            match: {
              id: `outside-${profile.id}`,
              user1Id: profile.id!,
              user2Id: "",
              user1Email: profile.email ?? "",
              user2Email: (profile.partnerEmail ?? "").trim() || "(outside)",
              status: "active",
              isPromDate: true,
              createdAt: profile.updatedAt ?? profile.createdAt ?? new Date().toISOString(),
            } as Schema["Match"]["type"],
            user1Profile: { ...profile, partnerName: partnerDisplay } as Schema["UserProfile"]["type"],
            user2Profile: undefined,
            promDateType: "partner-outside",
          });
        }
      }

      const promDatesList = matchesWithDetails.filter((m) => m.match.isPromDate === true);
      const sortByDate = (a: MatchWithUserDetails, b: MatchWithUserDetails) => {
        const dateA = a.match.createdAt ? new Date(a.match.createdAt).getTime() : 0;
        const dateB = b.match.createdAt ? new Date(b.match.createdAt).getTime() : 0;
        return dateB - dateA;
      };
      promDatesList.sort(sortByDate);
      setPromDates(promDatesList);
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
      setHealthCheckResult("Discovery scores computed successfully!");
      setTimeout(() => setHealthCheckResult(null), 5000);
    } catch (err) {
      logError(err, { component: "AdminPromDates", operation: "computeDiscoveryScores" });
      setError(err instanceof Error ? err.message : "Failed to compute discovery scores");
    } finally {
      setComputingScores(false);
    }
  };

  const handleEnsureMutualMatches = async () => {
    try {
      setEnsuringMatches(true);
      setError(null);
      const opts = !GOOGLE_LOGIN_CHECK ? { authMode: "apiKey" as const } : undefined;
      
      // Call the ensureMutualMatches query
      const result = await client.queries.ensureMutualMatches({}, opts);
      
      logInfo("Mutual matches ensured", { 
        component: "AdminPromDates", 
        operation: "ensureMutualMatches",
        extra: result.data 
      });
      
      // Refresh matches and stats after operation
      await Promise.all([fetchMatches(), fetchAllStats()]);
      setHealthCheckResult("Mutual matches check completed successfully!");
      setTimeout(() => setHealthCheckResult(null), 5000);
    } catch (err) {
      logError(err, { component: "AdminPromDates", operation: "ensureMutualMatches" });
      setError(err instanceof Error ? err.message : "Failed to ensure mutual matches");
    } finally {
      setEnsuringMatches(false);
    }
  };

  const handleExportData = async () => {
    try {
      setExportingData(true);
      setError(null);
      
      if (!stats || !advancedMetrics) {
        setError("No data to export. Please refresh the dashboard first.");
        return;
      }

      const exportData = {
        exportedAt: new Date().toISOString(),
        stats,
        advancedMetrics,
        promDates: promDates.map(pd => ({
          user1Name: pd.user1Profile?.name || pd.match.user1Email || "Unknown",
          user1Email: pd.match.user1Email || pd.user1Profile?.email || "N/A",
          user2Name: pd.promDateType === "partner-outside"
            ? (pd.user1Profile?.partnerName ?? (typeof pd.user1Profile?.bio === "string" && pd.user1Profile.bio.trim().match(/^Partner:\s*(.+)/)?.[1]?.trim()) ?? pd.match.user2Email || "Unknown")
            : (pd.user2Profile?.name || pd.match.user2Email || "Unknown"),
          user2Email: pd.promDateType === "partner-outside"
            ? (pd.match.user2Email === "(outside)" ? "N/A" : (pd.user1Profile?.partnerEmail || pd.match.user2Email || "N/A"))
            : (pd.match.user2Email || pd.user2Profile?.email || "N/A"),
          source: pd.promDateType === "partner-outside" ? "Non-IIMA partner" : pd.promDateType === "partner-iima" ? "IIMA partner" : "Discovery",
          isIIMACouple: isIIMACouple(pd.match, pd.user1Profile, pd.user2Profile, pd.promDateType),
          createdAt: pd.match.createdAt,
        })),
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `admin-dashboard-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      logInfo("Data exported", { component: "AdminPromDates", operation: "exportData" });
      setHealthCheckResult("Data exported successfully!");
      setTimeout(() => setHealthCheckResult(null), 5000);
    } catch (err) {
      logError(err, { component: "AdminPromDates", operation: "exportData" });
      setError(err instanceof Error ? err.message : "Failed to export data");
    } finally {
      setExportingData(false);
    }
  };

  const handleSystemHealthCheck = async () => {
    try {
      setError(null);
      setHealthCheckResult(null);
      
      const opts = !GOOGLE_LOGIN_CHECK ? { authMode: "apiKey" as const } : undefined;
      
      // Fetch all data to check for inconsistencies
      const [allProfiles, allMatches, allLikes, allConversations, allMessages] = await Promise.all([
        fetchAllWithPagination(client.models.UserProfile.list.bind(client.models.UserProfile), opts),
        fetchAllWithPagination((client.models.Match as any).list.bind(client.models.Match), opts),
        fetchAllWithPagination((client.models.Like as any).list.bind(client.models.Like), opts),
        fetchAllWithPagination((client.models.Conversation as any).list.bind(client.models.Conversation), opts),
        fetchAllWithPagination((client.models.Message as any).list.bind(client.models.Message), opts),
      ]);

      const issues: string[] = [];

      // Check for orphaned matches (users don't exist)
      const profileIds = new Set(allProfiles.map(p => p.id).filter(Boolean));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orphanedMatches = allMatches.filter((m: any) => {
        const user1Exists = !m.user1Id || profileIds.has(m.user1Id);
        const user2Exists = !m.user2Id || profileIds.has(m.user2Id);
        return !user1Exists || !user2Exists;
      });
      if (orphanedMatches.length > 0) {
        issues.push(`Found ${orphanedMatches.length} orphaned match(es) with missing user profiles`);
      }

      // Check for conversations without matches
      const matchIds = new Set(allMatches.map(m => m.id).filter(Boolean));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orphanedConversations = allConversations.filter((c: any) => 
        c.matchId && !matchIds.has(c.matchId)
      );
      if (orphanedConversations.length > 0) {
        issues.push(`Found ${orphanedConversations.length} conversation(s) without matching Match records`);
      }

      // Check for messages without conversations
      const conversationIds = new Set(allConversations.map(c => c.id).filter(Boolean));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orphanedMessages = allMessages.filter((m: any) => 
        m.conversationId && !conversationIds.has(m.conversationId)
      );
      if (orphanedMessages.length > 0) {
        issues.push(`Found ${orphanedMessages.length} message(s) without matching Conversation records`);
      }

      // Check for likes from/to non-existent users
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orphanedLikes = allLikes.filter((l: any) => 
        (l.fromUserId && !profileIds.has(l.fromUserId)) || 
        (l.toUserId && !profileIds.has(l.toUserId))
      );
      if (orphanedLikes.length > 0) {
        issues.push(`Found ${orphanedLikes.length} like(s) referencing non-existent user profiles`);
      }

      // Check for profiles with discovery scores but shouldn't have them
      const profilesWithInvalidScores = allProfiles.filter(p => {
        const hasScore = p.discoveryScore != null;
        const shouldHaveScore = p.id &&
          p.onboardingCompleted === true &&
          p.excludeFromDiscovery !== true &&
          !(typeof p.bio === "string" && p.bio.trim().startsWith("Partner:"));
        return hasScore && !shouldHaveScore;
      });
      if (profilesWithInvalidScores.length > 0) {
        issues.push(`Found ${profilesWithInvalidScores.length} profile(s) with discovery scores but shouldn't have them`);
      }

      if (issues.length === 0) {
        setHealthCheckResult("✓ System health check passed! No issues found.");
      } else {
        setHealthCheckResult(`⚠ Found ${issues.length} issue(s):\n${issues.join("\n")}`);
      }

      logInfo("System health check completed", { 
        component: "AdminPromDates", 
        operation: "healthCheck",
        extra: { issuesFound: issues.length, issues }
      });
    } catch (err) {
      logError(err, { component: "AdminPromDates", operation: "healthCheck" });
      setError(err instanceof Error ? err.message : "Failed to perform health check");
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

      {/* Tab Navigation */}
      <div className="sticky top-[73px] z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "overview"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Overview
              </div>
            </button>
            <button
              onClick={() => setActiveTab("tables")}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "tables"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <Table2 className="w-4 h-4" />
                Tables
              </div>
            </button>
            <button
              onClick={() => setActiveTab("metrics")}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "metrics"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Advanced Metrics
              </div>
            </button>
          </div>
        </div>
      </div>

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

          {healthCheckResult && (
            <div className={`mb-4 p-4 rounded-lg border ${
              healthCheckResult.startsWith("✓") 
                ? "bg-green-500/10 border-green-500 text-green-700 dark:text-green-400"
                : "bg-yellow-500/10 border-yellow-500 text-yellow-700 dark:text-yellow-400"
            }`}>
              <div className="whitespace-pre-line font-medium">{healthCheckResult}</div>
            </div>
          )}

          {/* Admin Actions Section */}
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Admin Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <Button 
                onClick={handleComputeDiscoveryScores} 
                disabled={computingScores}
                variant="outline"
                className="justify-start"
              >
                {computingScores ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Computing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Compute Discovery Scores
                  </>
                )}
              </Button>

              <Button 
                onClick={handleEnsureMutualMatches} 
                disabled={ensuringMatches}
                variant="outline"
                className="justify-start"
              >
                {ensuringMatches ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4 mr-2" />
                    Ensure Mutual Matches
                  </>
                )}
              </Button>

              <Button 
                onClick={handleSystemHealthCheck} 
                variant="outline"
                className="justify-start"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                System Health Check
              </Button>

              <Button 
                onClick={handleExportData} 
                disabled={exportingData || !stats || !advancedMetrics}
                variant="outline"
                className="justify-start"
              >
                {exportingData ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export Data (JSON)
                  </>
                )}
              </Button>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              <strong>Compute Discovery Scores:</strong> Manually trigger discovery score calculation for all eligible profiles.<br />
              <strong>Ensure Mutual Matches:</strong> Check for mutual likes and create Match records if missing.<br />
              <strong>System Health Check:</strong> Scan for data inconsistencies, orphaned records, and validation issues.<br />
              <strong>Export Data:</strong> Download all dashboard data, stats, and tables as JSON file.
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            !stats ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading dashboard data...</p>
                {error && (
                  <p className="text-destructive mt-2">Error: {error}</p>
                )}
              </div>
            ) : (
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
            )
          )}

          {/* Tables Tab */}
          {activeTab === "tables" && (
            <>
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
                        <TableHead>Source</TableHead>
                        <TableHead>IIMA Couple</TableHead>
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
                          const user2Name = item.promDateType === "partner-outside"
                            ? (item.user1Profile?.partnerName ?? (typeof item.user1Profile?.bio === "string" && item.user1Profile.bio.trim().match(/^Partner:\s*(.+)/)?.[1]?.trim()) ?? item.match.user2Email || "Unknown")
                            : (item.user2Profile?.name || item.match.user2Email || "Unknown");
                          const user2Email = item.promDateType === "partner-outside"
                            ? (item.match.user2Email === "(outside)" ? "N/A" : (item.user1Profile?.partnerEmail || item.match.user2Email || "N/A"))
                            : (item.match.user2Email || item.user2Profile?.email || "N/A");
                          const isIIMA = isIIMACouple(item.match, item.user1Profile, item.user2Profile, item.promDateType);
                          const sourceLabel = item.promDateType === "partner-outside"
                            ? "Non-IIMA partner"
                            : item.promDateType === "partner-iima"
                              ? "IIMA partner"
                              : "Discovery";

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
                                <span className="text-sm">{sourceLabel}</span>
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
            </>
          )}

          {/* Advanced Metrics Tab */}
          {activeTab === "metrics" && (
            !advancedMetrics ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading advanced metrics...</p>
                {error && (
                  <p className="text-destructive mt-2">Error: {error}</p>
                )}
              </div>
            ) : (
            <div className="space-y-6">
              {/* Conversion Funnel Metrics */}
              <div className={`p-4 bg-muted/50 rounded-lg ${metricsLoadingSections.has("conversion") ? "opacity-50" : ""}`}>
                {metricsLoadingSections.has("conversion") && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calculating...
                  </div>
                )}
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Conversion Funnel Metrics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Like-to-Match Rate</div>
                    <div className="text-lg font-semibold text-blue-600">
                      {advancedMetrics.likeToMatchRate.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Match-to-Prom Date Rate</div>
                    <div className="text-lg font-semibold text-green-600">
                      {advancedMetrics.matchToPromDateRate.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Prom Ask Acceptance</div>
                    <div className="text-lg font-semibold text-purple-600">
                      {advancedMetrics.promAskAcceptanceRate.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Match Request Acceptance</div>
                    <div className="text-lg font-semibold text-pink-600">
                      {advancedMetrics.matchRequestAcceptanceRate.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Engagement Metrics */}
              <div className={`p-4 bg-muted/50 rounded-lg ${metricsLoadingSections.has("engagement") ? "opacity-50" : ""}`}>
                {metricsLoadingSections.has("engagement") && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calculating...
                  </div>
                )}
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Engagement Metrics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Active (Last 7 Days)</div>
                    <div className="text-lg font-semibold text-blue-600">
                      {advancedMetrics.activeUsersLast7Days}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Daily Active Users</div>
                    <div className="text-lg font-semibold text-green-600">
                      {advancedMetrics.dailyActiveUsers}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Weekly Active Users</div>
                    <div className="text-lg font-semibold text-purple-600">
                      {advancedMetrics.weeklyActiveUsers}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Users with Photos</div>
                    <div className="text-lg font-semibold text-pink-600">
                      {advancedMetrics.usersWithPhotos}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ({stats ? ((advancedMetrics.usersWithPhotos / stats.totalUsers) * 100).toFixed(1) : 0}%)
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Users Who Sent Messages</div>
                    <div className="text-lg font-semibold text-orange-600">
                      {advancedMetrics.usersWhoSentMessages}
                    </div>
                  </div>
                </div>
              </div>

              {/* Time-based Metrics */}
              <div className={`p-4 bg-muted/50 rounded-lg ${metricsLoadingSections.has("timebased") ? "opacity-50" : ""}`}>
                {metricsLoadingSections.has("timebased") && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calculating...
                  </div>
                )}
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Time-based Metrics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Avg Time to Match</div>
                    <div className="text-lg font-semibold text-blue-600">
                      {advancedMetrics.avgTimeToMatchHours.toFixed(1)}h
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Avg Time to Prom Date</div>
                    <div className="text-lg font-semibold text-green-600">
                      {advancedMetrics.avgTimeToPromDateHours.toFixed(1)}h
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">New Users Today</div>
                    <div className="text-lg font-semibold text-purple-600">
                      {advancedMetrics.newUsersToday}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">New Users This Week</div>
                    <div className="text-lg font-semibold text-pink-600">
                      {advancedMetrics.newUsersThisWeek}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Recent Activity (24h)</div>
                    <div className="text-lg font-semibold text-orange-600">
                      {advancedMetrics.recentActivity24h}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quality Metrics */}
              <div className={`p-4 bg-muted/50 rounded-lg ${metricsLoadingSections.has("quality") ? "opacity-50" : ""}`}>
                {metricsLoadingSections.has("quality") && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calculating...
                  </div>
                )}
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <UserCheck className="w-5 h-5" />
                  Quality Metrics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Matches with Conversations</div>
                    <div className="text-lg font-semibold text-blue-600">
                      {advancedMetrics.matchesWithConversations}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ({advancedMetrics.matchesWithConversationsPercent.toFixed(1)}%)
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Prom Dates (Looking Flow)</div>
                    <div className="text-lg font-semibold text-green-600">
                      {advancedMetrics.promDatesFromLookingFlow}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Unmatch Rate</div>
                    <div className="text-lg font-semibold text-red-600">
                      {advancedMetrics.unmatchRate.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Avg Profile Completeness</div>
                    <div className="text-lg font-semibold text-purple-600">
                      {advancedMetrics.avgProfileCompleteness.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Cohort-specific Metrics */}
              <div className={`p-4 bg-muted/50 rounded-lg ${metricsLoadingSections.has("cohort") ? "opacity-50" : ""}`}>
                {metricsLoadingSections.has("cohort") && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calculating...
                  </div>
                )}
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Cohort-specific Metrics
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Most Active Cohorts</div>
                    <div className="space-y-2">
                      {advancedMetrics.mostActiveCohorts.map((item) => (
                        <div key={item.cohort} className="flex justify-between items-center text-sm p-2 bg-background/50 rounded">
                          <span className="font-medium">{item.cohort}</span>
                          <div className="flex gap-4">
                            <span className="text-muted-foreground">
                              {item.likes} likes, {item.matches} matches
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Prom Ask Metrics */}
              <div className={`p-4 bg-muted/50 rounded-lg ${metricsLoadingSections.has("promask") ? "opacity-50" : ""}`}>
                {metricsLoadingSections.has("promask") && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calculating...
                  </div>
                )}
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5" />
                  Prom Ask Metrics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Prom Asks Sent</div>
                    <div className="text-lg font-semibold text-blue-600">
                      {advancedMetrics.totalPromAsksSent}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Pending</div>
                    <div className="text-lg font-semibold text-orange-600">
                      {advancedMetrics.promAsksPending}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Accepted</div>
                    <div className="text-lg font-semibold text-green-600">
                      {advancedMetrics.promAsksAccepted}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Declined</div>
                    <div className="text-lg font-semibold text-red-600">
                      {advancedMetrics.promAsksDeclined}
                    </div>
                  </div>
                </div>
              </div>

              {/* Discovery Feed Metrics */}
              <div className={`p-4 bg-muted/50 rounded-lg ${metricsLoadingSections.has("discovery") ? "opacity-50" : ""}`}>
                {metricsLoadingSections.has("discovery") && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calculating...
                  </div>
                )}
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Discovery Feed Metrics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Average Discovery Score</div>
                    <div className="text-lg font-semibold text-blue-600">
                      {advancedMetrics.avgDiscoveryScore.toFixed(3)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">High Scores (&gt;0.7)</div>
                    <div className="text-lg font-semibold text-green-600">
                      {advancedMetrics.discoveryScoreDistribution.high}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Medium Scores (0.4-0.7)</div>
                    <div className="text-lg font-semibold text-yellow-600">
                      {advancedMetrics.discoveryScoreDistribution.medium}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Low Scores (&lt;0.4)</div>
                    <div className="text-lg font-semibold text-red-600">
                      {advancedMetrics.discoveryScoreDistribution.low}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Profiles Never Shown</div>
                    <div className="text-lg font-semibold text-gray-600">
                      {advancedMetrics.profilesNeverShown}
                    </div>
                  </div>
                </div>
              </div>

              {/* Flow Distribution Metrics */}
              <div className={`p-4 bg-muted/50 rounded-lg ${metricsLoadingSections.has("flow") ? "opacity-50" : ""}`}>
                {metricsLoadingSections.has("flow") ? (
                  <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calculating...
                  </div>
                ) : null}
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Flow Distribution Metrics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Looking Flow</div>
                    <div className="text-lg font-semibold text-blue-600">
                      {advancedMetrics.usersByFlowType.looking}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Partner Flow (IIMA)</div>
                    <div className="text-lg font-semibold text-green-600">
                      {advancedMetrics.usersByFlowType.partnerIIMA}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Partner Flow (Outside)</div>
                    <div className="text-lg font-semibold text-purple-600">
                      {advancedMetrics.usersByFlowType.partnerOutside}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Flow Changes</div>
                    <div className="text-lg font-semibold text-orange-600">
                      {advancedMetrics.flowChanges}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Partner Invite Success Rate</div>
                    <div className="text-lg font-semibold text-pink-600">
                      {advancedMetrics.partnerInviteSuccessRate.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )
          )}
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
