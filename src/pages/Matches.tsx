import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SparkleBackground from "@/components/SparkleBackground";
import PromAsk from "@/components/PromAsk";
import { useChat } from "@/hooks/useChat";
import { useMatches, type MatchWithDetails } from "@/hooks/useMatches";
import { useMatchRequests } from "@/hooks/useMatchRequests";
import { usePromAsk } from "@/hooks/usePromAsk";
import { usePromDate } from "@/hooks/usePromDate";
import { useViewedMatches } from "@/hooks/useViewedMatches";
import { useUnreadMatches } from "@/hooks/useUnreadMatches";
import { getUserProfile } from "@/utils/auth";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { GOOGLE_LOGIN_CHECK } from "@/config";
import { getUrl } from "aws-amplify/storage";
import ReportModal from "@/components/ReportModal";
import PendingPartnerRequestView from "@/components/PendingPartnerRequestView";
import WithdrawModal, { type WithdrawFormData } from "@/components/WithdrawModal";
import { dispatchBadgeRefresh, dispatchViewingMatch } from "@/utils/badgeRefresh";
import { getIdFromEmail } from "@/utils/userId";
import { logError, logInfo } from "@/utils/logger";
import { 
  Heart, 
  MessageCircle, 
  X,
  Send,
  MoreVertical,
  Flag,
  Trash2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const client = generateClient<Schema>();

const Matches = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  // Auth state
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // UI state
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [showPromAsk, setShowPromAsk] = useState(false);
  const [acceptingRequestId, setAcceptingRequestId] = useState<string | null>(null);
  const [acceptingPromAskId, setAcceptingPromAskId] = useState<string | null>(null);
  const [profilePicUrls, setProfilePicUrls] = useState<Record<string, string>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [lastMessageTimes, setLastMessageTimes] = useState<Record<string, string>>({});
  const [pendingOutgoingRequest, setPendingOutgoingRequest] = useState<{
    id: string;
    toEmail: string;
    partnerDisplayName: string;
  } | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  
  // Scroll to top when navigating to Matches
  useEffect(() => {
    const main = document.getElementById("app-main");
    if (main) main.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  useEffect(() => {
    logInfo("Matches page loaded", { component: "Matches", operation: "mount" });
  }, []);

  // Load current user on mount
  useEffect(() => {
    const loadUser = async () => {
      setIsAuthLoading(true);
      try {
        const profile = await getUserProfile();

        if (!profile?.email) {
          setAuthError("Please sign in to view your matches.");
          setCurrentUserId("");
          setCurrentUserEmail("");
          return;
        }

        const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
        const opts = authMode ? { authMode } : undefined;

        const listUserProfiles = () => {
          const filters = { filter: { email: { eq: profile.email } } };
          if (opts) {
            // @ts-ignore - authMode option not in generated types yet
            return client.models.UserProfile.list(filters, opts);
          }
          return client.models.UserProfile.list(filters);
        };

        const { data: userProfiles } = await listUserProfiles();
        const canonicalId = profile.email ? getIdFromEmail(profile.email) : null;
        const backendProfile = userProfiles?.find((p) => p.id === canonicalId) ?? userProfiles?.[0];

        if (!backendProfile?.id) {
          setAuthError("Complete onboarding to start matching.");
          setCurrentUserId("");
          setCurrentUserEmail(profile.email);
          return;
        }

        setCurrentUserId(backendProfile.id);
        setCurrentUserEmail(backendProfile.email || profile.email || "");
        setAuthError(null);
      } catch (err) {
        logError(err, { component: "Matches", operation: "loadUserProfile" });
        setAuthError("Unable to load your profile. Please try again.");
        setCurrentUserId("");
        setCurrentUserEmail("");
      } finally {
        setIsAuthLoading(false);
      }
    };
    loadUser();
  }, []);

  // Load real matches from database
  const { 
    matches: rawMatches, 
    isLoading: matchesLoading, 
    error: matchesError,
    refresh: refreshMatches,
    updateMatchConversation,
  } = useMatches({ 
    currentUserId, 
    currentUserEmail 
  });

  // Partner link requests (accept/decline)
  const {
    pendingRequests,
    refresh: refreshRequests,
    acceptRequest,
    declineRequest,
  } = useMatchRequests({ currentUserId, currentUserEmail });

  const {
    pendingToMe: promAskToMe,
    pendingFromMe: promAskFromMe,
    sendPromAsk,
    acceptPromAsk,
    declinePromAsk,
    refresh: refreshPromAsk,
  } = usePromAsk({ currentUserId });

  const { promDate, refresh: refreshPromDate } = usePromDate({ currentUserId });
  const { markMatchViewed } = useViewedMatches(currentUserId);
  const { clearUnread } = useUnreadMatches(currentUserId);

  const loadPendingOutgoing = useCallback(async () => {
    if (!currentUserId) return;
    const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
    const opts = authMode ? { authMode } : undefined;
    try {
      const { data: outgoing } = await client.models.MatchRequest.listMatchRequestByFromUserId(
        { fromUserId: currentUserId },
        opts
      );
      const pending = (outgoing ?? []).find((r) => r.status === "pending");
      if (pending) {
        const toEmail = pending.toEmail ?? "";
        setPendingOutgoingRequest({
          id: pending.id,
          toEmail,
          partnerDisplayName: toEmail.split("@")[0] || "your partner",
        });
      } else {
        setPendingOutgoingRequest(null);
      }
    } catch (err) {
      logError(err, { component: "Matches", operation: "loadPendingOutgoingRequest", extra: { currentUserId } });
      setPendingOutgoingRequest(null);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadPendingOutgoing();
  }, [loadPendingOutgoing]);

  // When user clicks Matches in nav, refetch matches and requests and clear refresh state
  useEffect(() => {
    if (location.state?.refresh) {
      refreshMatches();
      refreshRequests();
      refreshPromAsk();
      refreshPromDate();
      loadPendingOutgoing();
      navigate(location.pathname, { state: {}, replace: true });
    }
  }, [location.state?.refresh, location.pathname, navigate, refreshMatches, refreshRequests, refreshPromAsk, refreshPromDate, loadPendingOutgoing]);

  const handleAcceptPromAsk = async (requestId: string, matchId: string) => {
    setAcceptingPromAskId(requestId);
    try {
      const ok = await acceptPromAsk(requestId, matchId);
      if (ok) {
        await refreshMatches();
        await refreshPromAsk();
        await refreshPromDate();
        dispatchBadgeRefresh();
        navigate("/prom-date", { replace: true });
      }
    } catch (err) {
      logError(err, { component: "Matches", operation: "acceptPromAsk", extra: { promAskId } });
    } finally {
      setAcceptingPromAskId(null);
    }
  };

  const handleDeclinePromAsk = async (requestId: string) => {
    const ok = await declinePromAsk(requestId);
    if (ok) await refreshPromAsk();
    dispatchBadgeRefresh();
  };

  const handleAcceptRequest = async (
    requestId: string,
    fromUserId: string,
    fromEmail: string,
    fromName?: string
  ) => {
    setAcceptingRequestId(requestId);
    try {
      const ok = await acceptRequest(requestId, fromUserId, fromEmail, fromName);
      if (ok) {
        await refreshMatches();
        await refreshPromDate();
        dispatchBadgeRefresh();
        navigate("/prom-date");
      }
    } finally {
      setAcceptingRequestId(null);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    const ok = await declineRequest(requestId);
    if (ok) await refreshRequests();
    dispatchBadgeRefresh();
  };

  // Helper function to format last message time
  const formatLastMessageTime = (timestamp: string | null | undefined): string => {
    if (!timestamp) return "";
    
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffMs = now.getTime() - messageTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    
    // For older messages, show date
    return messageTime.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Fetch profile picture URLs for matches
  useEffect(() => {
    const fetchProfilePics = async () => {
      const urls: Record<string, string> = {};
      await Promise.all(
        rawMatches.map(async (match) => {
          const profilePicKey = match.otherUserProfile?.profilePicKey;
          if (profilePicKey) {
            try {
              const { url } = await getUrl({
                path: profilePicKey,
                options: { bucket: "userPhotos" },
              });
              urls[match.id] = url.toString();
            } catch (err) {
              logError(err, { component: "Matches", operation: "fetchProfilePic", extra: { profilePicKey, matchId: match.id } });
            }
          }
        })
      );
      setProfilePicUrls(urls);
    };

    if (rawMatches.length > 0) {
      fetchProfilePics();
    }
  }, [rawMatches]);

  // Fetch last message times for conversations
  useEffect(() => {
    const fetchLastMessageTimes = async () => {
      const times: Record<string, string> = {};
      const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
      const opts = authMode ? { authMode } : undefined;

      await Promise.all(
        rawMatches.map(async (match) => {
          if (match.conversationId) {
            try {
              // @ts-ignore - authMode option
              const { data: conversation } = await client.models.Conversation.get(
                { id: match.conversationId },
                opts
              );
              if (conversation?.lastMessageAt) {
                times[match.id] = formatLastMessageTime(conversation.lastMessageAt);
              }
            } catch (err) {
              logError(err, { component: "Matches", operation: "fetchConversation", extra: { matchId: match.id } });
            }
          }
        })
      );
      setLastMessageTimes(times);
    };

    if (rawMatches.length > 0) {
      fetchLastMessageTimes();
    }
  }, [rawMatches]);

  // Transform matches for UI
  const matchesForUI = rawMatches.map((m) => ({
    match: m,
    uiDisplayName:
      m.otherUserProfile?.name ||
      m.otherUserEmail?.split("@")[0] ||
      "Anonymous",
    profilePicUrl: profilePicUrls[m.id],
    lastMessageTime: lastMessageTimes[m.id] || "",
  }));

  // Open chat when coming from Prom Date (state.openMatchId) or URL matchId – set immediately so chat opens when matches load
  useEffect(() => {
    const fromPromDateState = location.state as { fromPromDate?: boolean; openMatchId?: string } | null;
    const matchIdToOpen = fromPromDateState?.openMatchId ?? searchParams.get("matchId");
    if (matchIdToOpen) {
      setActiveChat(matchIdToOpen);
      markMatchViewed(matchIdToOpen);
      clearUnread(matchIdToOpen);
    }
  }, [location.state, searchParams, markMatchViewed, clearUnread]);
  
  const activeMatch = rawMatches.find(m => m.id === activeChat);
  const activeConversationId = activeMatch?.conversationId || undefined;

  // Notify when viewing a chat (so badge doesn't mark it unread while user is in it)
  useEffect(() => {
    dispatchViewingMatch(activeChat);
    return () => dispatchViewingMatch(null);
  }, [activeChat]);

  // Store conversation ID when created (also update the match record)
  const handleConversationCreated = async (matchId: string, conversationId: string) => {
    await updateMatchConversation(matchId, conversationId);
  };


  // Redirect to Prom Date if user has one (unless they came from Prom Date to chat – stay on Matches)
  useEffect(() => {
    const fromPromDateState = location.state as { fromPromDate?: boolean } | null;
    if (fromPromDateState?.fromPromDate) return; // User came from Prom Date to chat – stay on Matches
    if (!isAuthLoading && currentUserId && promDate) {
      navigate("/prom-date", { replace: true });
    }
  }, [isAuthLoading, currentUserId, promDate, navigate, location.state]);

  // Show loading while checking auth
  if (isAuthLoading) {
    return (
      <div className="min-h-dvh bg-gradient-midnight flex items-center justify-center">
        <SparkleBackground />
        <div className="relative z-10 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Pending outgoing partner request – no access to chat or discover
  const handleWithdrawConfirm = async (data: WithdrawFormData) => {
    if (!pendingOutgoingRequest?.id) return;
    setWithdrawing(true);
    try {
      const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
      const opts = authMode ? { authMode } : undefined;
      await client.models.MatchRequest.update(
        { id: pendingOutgoingRequest.id, status: "withdrawn" },
        opts
      );
      const { data: myProfiles } = await client.models.UserProfile.list(
        { filter: { email: { eq: currentUserEmail } } },
        opts
      );
      if (myProfiles?.[0]?.id) {
        await client.models.UserProfile.update(
          {
            id: myProfiles[0].id,
            bio: undefined,
            partnerStatus: "Still looking for my prom date 💫",
            partnerEmail: "",
            partnerName: "",
            sexualOrientation: data.sexualOrientation,
            intention: data.intention,
            hometown: data.hometown,
            foodPreference: "Flexible",
            onboardingCompleted: true,
          },
          opts
        );
      }
      setPendingOutgoingRequest(null);
      await loadPendingOutgoing();
      navigate("/discover/profile", { state: { refresh: true } });
    } catch (e) {
      logError(e, { component: "Matches", operation: "withdraw" });
      throw e;
    } finally {
      setWithdrawing(false);
    }
  };

  if (pendingOutgoingRequest && !authError) {
    return (
      <div className="min-h-dvh bg-gradient-midnight relative flex flex-col w-full">
        <SparkleBackground />
        <div className="relative z-10 flex flex-col flex-1 w-full max-w-[500px] mx-auto">
          <header className="p-4 border-b border-border/50 shrink-0">
            <h1 className="font-display text-3xl font-bold">Your Prom Invite ✨</h1>
          </header>
          <div className="flex-1 flex flex-col min-h-0">
            <PendingPartnerRequestView
              partnerDisplayName={pendingOutgoingRequest.partnerDisplayName}
              onWithdraw={() => setShowWithdrawModal(true)}
              isWithdrawing={withdrawing}
            />
          </div>
        </div>
        <WithdrawModal
          open={showWithdrawModal}
          onOpenChange={setShowWithdrawModal}
          onConfirm={handleWithdrawConfirm}
        />
      </div>
    );
  }

  return (
    <div className={`bg-gradient-midnight relative flex flex-col w-full overflow-hidden ${activeChat ? 'h-full min-h-0 flex-1' : 'min-h-dvh'}`}>
      <SparkleBackground />

      {/* Dev mode banner */}
      {authError && (
        <div className="relative z-20 bg-yellow-500/10 border-b border-yellow-500/20 p-2 shrink-0 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <span className="text-yellow-200">{authError}</span>
            <span className="text-muted-foreground">• User ID: {currentUserId.slice(0, 12)}...</span>
          </div>
        </div>
      )}

      <div className="relative z-10 flex-1 flex min-h-0 overflow-hidden w-full max-w-[500px] mx-auto">

      {/* Match List - full width when no chat open (same UX on all screen sizes) */}
      <aside className={`flex-1 min-w-0 w-full flex flex-col min-h-0 border-r border-border/50 ${activeChat ? 'hidden' : 'flex'}`}>
        {/* Header */}
        <header className="p-4 border-b border-border/50 shrink-0">
          <h1 className="font-display text-3xl font-bold">Matches</h1>
        </header>

        {/* Partner requests - confirm match */}
        {pendingRequests.length > 0 && (
          <div className="p-3 border-b border-border/50 shrink-0">
            <p className="text-sm font-medium text-foreground mb-2">Partner requests</p>
            <p className="text-xs text-muted-foreground mb-3">
              Someone wants to link with you as their partner. Accept to get matched.
            </p>
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between gap-2 p-3 rounded-xl glass mb-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">
                    {req.fromName || req.fromEmail?.split("@")[0] || "Someone"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{req.fromEmail}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeclineRequest(req.id)}
                    disabled={!!acceptingRequestId}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      handleAcceptRequest(
                        req.id,
                        req.fromUserId,
                        req.fromEmail,
                        req.fromName ?? undefined
                      )
                    }
                    disabled={!!acceptingRequestId}
                  >
                    {acceptingRequestId === req.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Accept"
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Match List */}
        <div className="flex-1 overflow-y-auto p-2 min-h-0 flex flex-col">
          {/* Loading state */}
          {matchesLoading && rawMatches.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error state */}
          {matchesError && (
            <div className="text-center py-8 text-destructive text-sm">
              {matchesError}
            </div>
          )}

          {/* Empty state */}
          {!matchesLoading && rawMatches.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground mb-2">No matches yet</p>
                <p className="text-sm text-muted-foreground/70">
                  Complete discovery to get matched.
                </p>
              </div>
            </div>
          )}

          {/* Matches - name only, no email */}
          {matchesForUI.map(({ match, uiDisplayName, profilePicUrl, lastMessageTime }) => (
            <motion.button
              key={match.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                logInfo("Matches: chat opened", { component: "Matches", operation: "openChat", extra: { matchId: match.id, otherUserId: match.otherUserId } });
                setActiveChat(match.id);
                markMatchViewed(match.id);
                clearUnread(match.id);
              }}
              className={`w-full p-4 rounded-xl mb-3 text-left transition-all duration-300 relative overflow-hidden ${
                activeChat === match.id 
                  ? "bg-primary/25 border-2 border-primary/40 shadow-lg shadow-primary/20" 
                  : "bg-background/30 backdrop-blur-md border border-primary/20 hover:bg-background/40 hover:border-primary/30 hover:shadow-md hover:shadow-primary/10"
              }`}
            >
              {/* Subtle shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500" />
              
              <div className="flex items-center gap-3 relative z-10">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 overflow-hidden ${
                  activeChat === match.id 
                    ? "ring-2 ring-primary/50" 
                    : "ring-1 ring-primary/30"
                } ${profilePicUrl && !imageErrors[match.id] ? "bg-muted" : "bg-primary/20"}`}>
                  {profilePicUrl && !imageErrors[match.id] ? (
                    <img
                      src={profilePicUrl}
                      alt={uiDisplayName}
                      className="w-full h-full object-cover"
                      onError={() => {
                        setImageErrors((prev) => ({ ...prev, [match.id]: true }));
                      }}
                    />
                  ) : (
                    <Heart className={`w-5 h-5 transition-colors ${
                      activeChat === match.id ? "text-primary" : "text-primary/80"
                    }`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-semibold block truncate transition-colors ${
                      activeChat === match.id ? "text-foreground" : "text-foreground/90"
                    }`}>
                      {uiDisplayName}
                    </span>
                    {lastMessageTime && (
                      <span className={`text-xs shrink-0 transition-colors ${
                        activeChat === match.id 
                          ? "text-primary/80" 
                          : "text-muted-foreground"
                      }`}>
                        {lastMessageTime}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </aside>

      {/* Chat Area - full screen when open, no scroll, only messages scroll */}
      <main className={`flex-1 min-w-0 w-full flex flex-col min-h-0 overflow-hidden ${!activeChat ? 'hidden' : 'flex'}`}>
        {activeChat && activeMatch ? (
          <ChatView 
            match={activeMatch}
            conversationId={activeConversationId}
            currentUserId={currentUserId}
            onBack={() => location.state?.fromPromDate ? navigate("/prom-date", { replace: true }) : setActiveChat(null)}
            onConversationCreated={(convId) => handleConversationCreated(activeMatch.id, convId)}
            onAskToProm={() => setShowPromAsk(true)}
            showAskToProm={!activeMatch.isPromDate && !promAskFromMe.some((r) => r.toUserId === activeMatch.otherUserId)}
            promAskFromThem={promAskToMe.find((r) => r.fromUserId === activeMatch.otherUserId)}
            onAcceptPromAsk={(reqId) => handleAcceptPromAsk(reqId, activeMatch.id)}
            acceptingPromAskId={acceptingPromAskId}
            onDeclinePromAsk={handleDeclinePromAsk}
            refreshPromAsk={refreshPromAsk}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-display text-xl font-semibold mb-2">Select a match</h3>
              <p className="text-muted-foreground">
                Choose someone from your matches to start chatting
              </p>
            </div>
          </div>
        )}
      </main>
      </div>

      {/* Prom Ask Modal - portal renders at body level */}
      <AnimatePresence>
        {showPromAsk && activeMatch && (
          <PromAsk
            key="prom-ask-modal"
            matchId={activeMatch.id}
            otherUserId={activeMatch.otherUserId}
            matchCompatScore={activeMatch.compatScore || 0}
            onClose={() => setShowPromAsk(false)}
            onSend={async (msg) => {
              const result = await sendPromAsk(activeMatch.otherUserId, activeMatch.id, msg);
              if (result.ok) {
                await refreshPromAsk();
                setShowPromAsk(false);
              }
              return result;
            }}
          />
        )}
      </AnimatePresence>

    </div>
  );
};

// Chat View Component - Now using real Amplify backend
interface ChatViewProps {
  match: MatchWithDetails;
  conversationId?: string;
  currentUserId: string;
  onBack: () => void;
  onConversationCreated?: (conversationId: string) => void;
  onAskToProm?: () => void;
  showAskToProm?: boolean;
  promAskFromThem?: { id: string; fromUserId: string; message?: string | null } | undefined;
  onAcceptPromAsk?: (requestId: string) => void;
  onDeclinePromAsk?: (requestId: string) => Promise<boolean>;
  refreshPromAsk?: () => Promise<void>;
  acceptingPromAskId?: string | null;
}

const ChatView = ({ 
  match, 
  conversationId, 
  currentUserId,
  onBack,
  onConversationCreated,
  onAskToProm,
  showAskToProm,
  promAskFromThem,
  onAcceptPromAsk,
  onDeclinePromAsk,
  refreshPromAsk,
  acceptingPromAskId,
}: ChatViewProps) => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const displayName =
    match.otherUserProfile?.name ||
    match.otherUserEmail?.split("@")[0] ||
    "Anonymous";

  // Fetch profile picture URL
  useEffect(() => {
    const fetchProfilePic = async () => {
      const profilePicKey = match.otherUserProfile?.profilePicKey;
      if (profilePicKey) {
        try {
          const { url } = await getUrl({
            path: profilePicKey,
            options: { bucket: "userPhotos" },
          });
          setProfilePicUrl(url.toString());
        } catch {
          // Profile pic unavailable
        }
      }
    };
    fetchProfilePic();
  }, [match.otherUserProfile?.profilePicKey]);

  // Use the real chat hook
  const {
    conversation,
    messages,
    messagesLoading,
    isLoading,
    error,
    sendMessage: sendChatMessage,
    createConversation,
  } = useChat({
    conversationId,
    currentUserId,
  });

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to top when opening a new chat so header/name is visible
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = 0;
    }
  }, [match.id]);

  // Auto-scroll to bottom when new messages arrive (after initial load)
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Create conversation if none exists when component mounts
  useEffect(() => {
    const initConversation = async () => {
      if (!conversationId && !isCreatingConversation && match.otherUserId) {
        setIsCreatingConversation(true);
        const newConvo = await createConversation(match.otherUserId);
        if (newConvo?.id) {
          onConversationCreated(newConvo.id);
        }
        setIsCreatingConversation(false);
      }
    };
    initConversation();
  }, [conversationId, match.otherUserId, createConversation, onConversationCreated, isCreatingConversation]);

  const icebreakers = [
    "What's your favorite IIMA hangout?",
    "Drop a song that defines you 🎵",
    "Would you rather... early morning or late night?",
    "What brought you to IIMA?",
  ];

  const handleSendMessage = async () => {
    if (message.trim()) {
      await sendChatMessage(message);
      setMessage("");
    }
  };

  // Show loading while creating conversation
  if (isCreatingConversation || (isLoading && !conversation)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">Starting conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full min-h-0 overflow-hidden flex-1 w-full">
      <ReportModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        personName={displayName}
        personId={match.otherUserId}
        personEmail={match.otherUserEmail}
        context="Chat"
      />
      {/* Chat header - same color as background, blends seamlessly */}
      <header className="sticky top-0 shrink-0 z-20 p-3 sm:p-4 border-b border-primary/20 flex items-center justify-between bg-transparent min-h-[56px]">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to matches">
            <X className="w-5 h-5" />
          </Button>
          
          <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ring-1 ring-primary/30 ${
            profilePicUrl && !imageError ? "bg-muted" : "bg-primary/20"
          }`}>
            {profilePicUrl && !imageError ? (
              <img
                src={profilePicUrl}
                alt={displayName}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <Heart className="w-5 h-5 text-primary" />
            )}
          </div>
          
          <div>
            <button
              type="button"
              onClick={() => { logInfo("Matches: view full profile from chat", { component: "Matches", operation: "viewFullProfile", extra: { otherUserId: match.otherUserId } }); navigate(`/discover/profile/${match.otherUserId}`, { state: { fromChat: true } }); }}
              className="font-semibold text-foreground hover:text-primary hover:underline text-left"
            >
              {displayName}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showAskToProm && onAskToProm && (
            <Button
              variant="default"
              size="sm"
              onClick={() => { logInfo("Matches: Ask to Prom clicked", { component: "Matches", operation: "askToProm", extra: { otherUserId: match.otherUserId } }); onAskToProm?.(); }}
              className="bg-primary hover:bg-primary/90"
            >
              <Heart className="w-4 h-4 mr-2" />
              Ask to Prom
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setReportOpen(true)}>
                <Flag className="w-4 h-4 mr-2" />
                Report
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Unmatch
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Messages area - ONLY scrollable section, takes remaining space */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden basis-0">
      {/* Prom Ask request from them - Accept / Decline */}
      {promAskFromThem && onAcceptPromAsk && onDeclinePromAsk && (
        <div className="px-4 py-3 bg-primary/10 border-b border-primary/20 shrink-0">
          <p className="text-sm font-medium text-foreground mb-1">
            {displayName} wants to go to Prom with you!
          </p>
          {promAskFromThem.message && (
            <p className="text-sm text-muted-foreground mb-3 italic">&quot;{promAskFromThem.message}&quot;</p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDeclinePromAsk(promAskFromThem.id)}
              disabled={!!acceptingPromAskId}
            >
              Maybe another time
            </Button>
            <Button
              size="sm"
              onClick={() => onAcceptPromAsk(promAskFromThem.id)}
              disabled={!!acceptingPromAskId}
            >
              {acceptingPromAskId === promAskFromThem.id ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Making it official...
                </>
              ) : (
                "Yes, let's go"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm shrink-0">
          {error}
        </div>
      )}

      {/* Messages - ONLY scrollable element on screen */}
      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-4 overscroll-contain">
        {messagesLoading && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        
        {!messagesLoading && messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground/70">Send a message to start the conversation!</p>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.senderId === currentUserId;
          const time = msg.sentAt
            ? new Date(msg.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "";

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  isMe
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "glass rounded-bl-md"
                }`}
              >
                <p>{msg.content}</p>
                {time && (
                  <p className={`text-xs mt-1 ${
                    isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}>
                    {time}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      </div>

      {/* Icebreakers + Input - always visible at bottom */}
      <div className="shrink-0 flex flex-col border-t border-border/50 bg-background/95 backdrop-blur-sm">
      <div className="px-3 sm:px-4 py-2 shrink-0">
        <p className="text-xs text-muted-foreground mb-2">💡 Icebreakers</p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {icebreakers.map((icebreaker, i) => (
            <button
              key={i}
              onClick={() => setMessage(icebreaker)}
              className="shrink-0 px-3 py-1.5 rounded-full glass text-sm hover:bg-card/70 transition-colors"
            >
              {icebreaker}
            </button>
          ))}
        </div>
      </div>

      {/* Input - typing area - padding to clear nav and avoid cutoff */}
      <div className="px-3 sm:px-4 pt-3 sm:pt-4 shrink-0 chat-input-area-pb">
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setReportOpen(true)}
            className="h-12 w-12 shrink-0 rounded-xl border-muted-foreground/40 hover:border-destructive/50 hover:bg-destructive/10"
            title="Report"
            aria-label="Report"
          >
            <Flag className="h-5 w-5 text-muted-foreground" />
          </Button>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-muted rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <Button variant="gold" size="icon" onClick={handleSendMessage} disabled={!message.trim()}>
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Matches;
