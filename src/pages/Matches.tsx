import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SparkleBackground from "@/components/SparkleBackground";
import PromAsk from "@/components/PromAsk";
import { useChat } from "@/hooks/useChat";
import { useMatches, type MatchWithDetails } from "@/hooks/useMatches";
import { useMatchRequests } from "@/hooks/useMatchRequests";
import { getUserProfile } from "@/utils/auth";
import { 
  Heart, 
  MessageCircle, 
  Sparkles, 
  Eye, 
  X,
  Send,
  MoreVertical,
  Flag,
  Trash2,
  PartyPopper,
  Loader2,
  Plus,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Extended match type for UI
interface MatchForUI extends MatchWithDetails {
  displayName: string;
  tags: string[];
}

const Matches = () => {
  const navigate = useNavigate();
  
  // Auth state
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // UI state
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [showRevealModal, setShowRevealModal] = useState(false);
  const [showPromAsk, setShowPromAsk] = useState(false);
  const [showCreateMatch, setShowCreateMatch] = useState(false);
  const [newMatchEmail, setNewMatchEmail] = useState("");
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  const [acceptingRequestId, setAcceptingRequestId] = useState<string | null>(null);
  
  // Load current user on mount
  useEffect(() => {
    const loadUser = async () => {
      setIsAuthLoading(true);
      try {
        const profile = await getUserProfile();
        if (profile && profile.userId) {
          setCurrentUserId(profile.userId);
          setCurrentUserEmail(profile.email || "");
        } else {
          // For development: use a test user ID
          setCurrentUserId("dev-user-" + Math.random().toString(36).substr(2, 9));
          setCurrentUserEmail("dev@test.com");
          setAuthError("Not authenticated - using dev mode");
        }
      } catch (err) {
        // For development: use a test user ID
        setCurrentUserId("dev-user-" + Math.random().toString(36).substr(2, 9));
        setCurrentUserEmail("dev@test.com");
        setAuthError("Auth error - using dev mode");
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
    createMatch,
    updateMatchConversation,
  } = useMatches({ 
    currentUserId, 
    currentUserEmail 
  });

  // Partner link requests (accept/decline)
  const {
    pendingRequests,
    isLoading: requestsLoading,
    refresh: refreshRequests,
    acceptRequest,
    declineRequest,
  } = useMatchRequests({ currentUserId, currentUserEmail });

  const handleAcceptRequest = async (
    requestId: string,
    fromUserId: string,
    fromEmail: string,
    fromName?: string
  ) => {
    setAcceptingRequestId(requestId);
    try {
      const ok = await acceptRequest(requestId, fromUserId, fromEmail, fromName);
      if (ok) await refreshMatches();
    } finally {
      setAcceptingRequestId(null);
    }
  };

  // Transform matches for UI
  const matches: MatchForUI[] = rawMatches.map(m => ({
    ...m,
    displayName: m.otherUserEmail?.split("@")[0] || "Anonymous",
    tags: [], // Tags would come from user profile in production
  }));
  
  const activeMatch = matches.find(m => m.id === activeChat);
  const activeConversationId = activeMatch?.conversationId || undefined;

  // Reveal callback - will be set by ChatView
  const [pendingRevealFn, setPendingRevealFn] = useState<(() => Promise<void>) | null>(null);

  const handleReveal = (revealFn: () => Promise<void>) => {
    setPendingRevealFn(() => revealFn);
    setShowRevealModal(true);
  };

  const confirmReveal = async () => {
    if (pendingRevealFn) {
      await pendingRevealFn();
    }
    setShowRevealModal(false);
    setPendingRevealFn(null);
  };

  // Store conversation ID when created (also update the match record)
  const handleConversationCreated = async (matchId: string, conversationId: string) => {
    await updateMatchConversation(matchId, conversationId);
  };

  // Create a new match (for testing)
  const handleCreateMatch = async () => {
    if (!newMatchEmail.trim()) return;
    setIsCreatingMatch(true);
    try {
      // In production, you'd look up the user by email
      // For now, we'll use the email as a pseudo-user-id
      const otherUserId = newMatchEmail.trim();
      await createMatch(otherUserId, newMatchEmail.trim(), 0.8);
      setNewMatchEmail("");
      setShowCreateMatch(false);
    } finally {
      setIsCreatingMatch(false);
    }
  };

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

  return (
    <div className="min-h-dvh bg-gradient-midnight relative overflow-hidden flex flex-col">
      <SparkleBackground />

      {/* Dev mode banner */}
      {authError && (
        <div className="relative z-20 bg-yellow-500/10 border-b border-yellow-500/20 p-2">
          <div className="max-w-4xl mx-auto flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <span className="text-yellow-200">{authError}</span>
            <span className="text-muted-foreground">• User ID: {currentUserId.slice(0, 12)}...</span>
          </div>
        </div>
      )}

      <div className="flex-1 flex relative z-10">

      {/* Sidebar - Match List */}
      <aside className={`w-full md:w-80 lg:w-96 border-r border-border/50 flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <header className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-display text-2xl font-bold">Matches</h1>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={refreshMatches} title="Refresh">
                <RefreshCw className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigate("/discover/profile")}>
                <Sparkles className="w-5 h-5" />
              </Button>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="glass" size="sm" className="flex-1">
              All ({matches.length})
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex-1"
              onClick={() => setShowCreateMatch(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Match
            </Button>
          </div>
        </header>

        {/* Partner requests - confirm match */}
        {pendingRequests.length > 0 && (
          <div className="p-3 border-b border-border/50">
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
                    onClick={() => declineRequest(req.id)}
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
        <div className="flex-1 overflow-y-auto p-2">
          {/* Loading state */}
          {matchesLoading && matches.length === 0 && (
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
          {!matchesLoading && matches.length === 0 && (
            <div className="text-center py-8">
              <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground mb-2">No matches yet</p>
              <p className="text-sm text-muted-foreground/70 mb-4">
                Complete discovery to get matched, or add a test match below.
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowCreateMatch(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Create Test Match
              </Button>
            </div>
          )}

          {/* Matches */}
          {matches.map((match) => (
            <motion.button
              key={match.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveChat(match.id)}
              className={`w-full p-3 rounded-xl mb-2 text-left transition-colors ${
                activeChat === match.id 
                  ? "bg-primary/20 border border-primary/30" 
                  : "glass hover:bg-card/70"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Avatar placeholder */}
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Heart className="w-5 h-5 text-primary" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-foreground">
                      {match.displayName}
                    </span>
                    {match.compatScore && (
                      <span className="text-xs text-primary">
                        {Math.round((match.compatScore || 0) * 100)}%
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground truncate mb-1">
                    {match.otherUserEmail}
                  </p>
                  
                  <p className="text-sm text-primary">
                    {match.conversationId ? "Continue chat →" : "Start chat →"}
                  </p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </aside>

      {/* Chat Area */}
      <main className={`flex-1 flex flex-col ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
        {activeChat && activeMatch ? (
          <ChatView 
            match={activeMatch}
            conversationId={activeConversationId}
            currentUserId={currentUserId}
            onBack={() => setActiveChat(null)}
            onReveal={handleReveal}
            onPromAsk={() => setShowPromAsk(true)}
            onConversationCreated={(convId) => handleConversationCreated(activeMatch.id, convId)}
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

      {/* Reveal Modal */}
      <AnimatePresence>
        {showRevealModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-3xl p-8 max-w-md w-full text-center"
            >
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Eye className="w-8 h-8 text-primary" />
              </div>
              
              <h3 className="font-display text-2xl font-bold mb-2">Ready to Reveal?</h3>
              <p className="text-muted-foreground mb-6">
                When you both reveal, you'll see each other's photos, names, and contact details. 
                This cannot be undone.
              </p>

              <div className="glass rounded-xl p-4 mb-6 text-left">
                <p className="text-sm text-foreground font-medium mb-1">🔒 Privacy Promise</p>
                <p className="text-xs text-muted-foreground">
                  Only you and your match will see revealed details. Organisers and other users cannot access this information.
                </p>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="glass" 
                  className="flex-1"
                  onClick={() => setShowRevealModal(false)}
                >
                  Not Yet
                </Button>
                <Button 
                  variant="gold" 
                  className="flex-1"
                  onClick={confirmReveal}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Reveal Identity
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prom Ask Modal */}
      <AnimatePresence>
        {showPromAsk && activeMatch && (
          <PromAsk
            matchId={activeMatch.id}
            matchCompatScore={activeMatch.compatScore || 0}
            onClose={() => setShowPromAsk(false)}
          />
        )}
      </AnimatePresence>

      {/* Create Match Modal (for testing) */}
      <AnimatePresence>
        {showCreateMatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-3xl p-6 max-w-md w-full"
            >
              <h3 className="font-display text-xl font-bold mb-4">Create Test Match</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Enter another user's email or ID to create a match for testing.
                Both users need to create a match with each other to chat.
              </p>
              
              <Input
                placeholder="Other user's email or ID"
                value={newMatchEmail}
                onChange={(e) => setNewMatchEmail(e.target.value)}
                className="mb-4"
              />

              <div className="bg-muted/30 rounded-lg p-3 mb-4 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">How to test:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open the app in two different browsers</li>
                  <li>Sign in with different Google accounts</li>
                  <li>Each person creates a match with the other's email</li>
                  <li>Both will see each other in their matches list</li>
                  <li>Click to start chatting!</li>
                </ol>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="glass" 
                  className="flex-1"
                  onClick={() => setShowCreateMatch(false)}
                >
                  Cancel
                </Button>
                <Button 
                  variant="gold" 
                  className="flex-1"
                  onClick={handleCreateMatch}
                  disabled={!newMatchEmail.trim() || isCreatingMatch}
                >
                  {isCreatingMatch ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-1" />
                      Create Match
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Chat View Component - Now using real Amplify backend
interface ChatViewProps {
  match: MatchForUI;
  conversationId?: string;
  currentUserId: string;
  onBack: () => void;
  onReveal: (revealFn: () => Promise<void>) => void;
  onPromAsk: () => void;
  onConversationCreated: (conversationId: string) => void;
}

const ChatView = ({ 
  match, 
  conversationId, 
  currentUserId,
  onBack, 
  onReveal, 
  onPromAsk,
  onConversationCreated 
}: ChatViewProps) => {
  const [message, setMessage] = useState("");
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use the real chat hook
  const {
    conversation,
    messages,
    messagesLoading,
    isLoading,
    error,
    sendMessage: sendChatMessage,
    revealIdentity,
    createConversation,
    hasCurrentUserRevealed,
    hasOtherUserRevealed,
  } = useChat({
    conversationId,
    currentUserId,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  const handleRevealClick = () => {
    // Pass the reveal function to the parent so modal can confirm first
    onReveal(revealIdentity);
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
    <>
      {/* Chat Header */}
      <header className="p-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
            <X className="w-5 h-5" />
          </Button>
          
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary" />
          </div>
          
          <div>
            <p className="font-semibold">{match.displayName}</p>
            <p className="text-xs text-muted-foreground">{match.otherUserEmail}</p>
            {hasOtherUserRevealed && (
              <p className="text-xs text-green-400">They revealed their identity!</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="rose" size="sm" onClick={onPromAsk}>
            <PartyPopper className="w-4 h-4 mr-1" />
            Ask to Prom
          </Button>
          <Button 
            variant={hasCurrentUserRevealed ? "secondary" : "gold"} 
            size="sm" 
            onClick={handleRevealClick}
            disabled={hasCurrentUserRevealed}
          >
            <Eye className="w-4 h-4 mr-1" />
            {hasCurrentUserRevealed ? "Revealed" : "Reveal"}
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
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

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                {!isMe && (
                  <p className="text-xs text-muted-foreground mb-0.5">
                    {hasOtherUserRevealed ? "Match" : "Anonymous"}
                  </p>
                )}
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

      {/* Icebreakers */}
      <div className="px-4 py-2 border-t border-border/50">
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

      {/* Input */}
      <div className="p-4 border-t border-border/50">
        <div className="flex gap-2">
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
    </>
  );
};

export default Matches;
