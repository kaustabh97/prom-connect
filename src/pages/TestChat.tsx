import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SparkleBackground from "@/components/SparkleBackground";
import { MessageCircle, Send, ArrowLeft, Eye, EyeOff, UserCircle, Loader2, Plus } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import type { Schema } from "../../amplify/data/resource";

type Message = Schema["Message"]["type"];

// Test user IDs for sandbox testing
const TEST_USER_A = "test-user-a-12345";
const TEST_USER_B = "test-user-b-67890";

const TestChat = () => {
  const navigate = useNavigate();
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Two separate chat hook instances - one for each test user
  const chatA = useChat({ conversationId: conversationId || undefined, currentUserId: TEST_USER_A });
  const chatB = useChat({ conversationId: conversationId || undefined, currentUserId: TEST_USER_B });

  const [inputA, setInputA] = useState("");
  const [inputB, setInputB] = useState("");

  // Create a new test conversation
  const handleCreateConversation = async () => {
    const newConvo = await chatA.createConversation(TEST_USER_B);
    if (newConvo?.id) {
      setConversationId(newConvo.id);
    }
  };

  // Determine loading state
  const isCreating = chatA.isLoading && !conversationId;
  const isLoadingMessages = chatA.messagesLoading || chatB.messagesLoading;

  return (
    <div className="min-h-screen bg-gradient-midnight relative overflow-hidden flex flex-col w-full">
      <SparkleBackground />

      {/* Header */}
      <header className="relative z-10 p-4 border-b border-border/50 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/matches")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h1 className="font-display text-xl font-bold">Chat Test (Amplify Backend)</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-auto hidden sm:inline">
          Test real-time chat with identity reveal
        </p>
      </header>

      {/* Create conversation prompt if none exists */}
      {!conversationId && (
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 p-8">
            <MessageCircle className="w-16 h-16 text-primary mx-auto opacity-50" />
            <h2 className="text-xl font-semibold">No Active Conversation</h2>
            <p className="text-muted-foreground max-w-md">
              Create a test conversation between two simulated users to test the chat functionality.
            </p>
            <Button
              variant="gold"
              onClick={handleCreateConversation}
              disabled={isCreating}
              className="mt-4"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Test Conversation
                </>
              )}
            </Button>
            {chatA.error && (
              <p className="text-destructive text-sm mt-2">{chatA.error}</p>
            )}
          </div>
        </div>
      )}

      {/* Two chat panels side by side */}
      {conversationId && (
        <div className="relative z-10 flex-1 flex min-h-0">
          {/* User A panel */}
          <ChatPanel
            userLabel="User A"
            otherUserLabel="User B"
            currentUserId={TEST_USER_A}
            messages={chatA.messages}
            inputValue={inputA}
            onInputChange={setInputA}
            onSend={() => {
              if (inputA.trim()) {
                chatA.sendMessage(inputA);
                setInputA("");
              }
            }}
            placeholder="User A types here..."
            isLoading={isLoadingMessages}
            hasCurrentUserRevealed={chatA.hasCurrentUserRevealed}
            hasOtherUserRevealed={chatA.hasOtherUserRevealed}
            onRevealIdentity={chatA.revealIdentity}
          />
          {/* Divider */}
          <div className="w-px bg-border/50 shrink-0" />
          {/* User B panel */}
          <ChatPanel
            userLabel="User B"
            otherUserLabel="User A"
            currentUserId={TEST_USER_B}
            messages={chatB.messages}
            inputValue={inputB}
            onInputChange={setInputB}
            onSend={() => {
              if (inputB.trim()) {
                chatB.sendMessage(inputB);
                setInputB("");
              }
            }}
            placeholder="User B types here..."
            isLoading={isLoadingMessages}
            hasCurrentUserRevealed={chatB.hasCurrentUserRevealed}
            hasOtherUserRevealed={chatB.hasOtherUserRevealed}
            onRevealIdentity={chatB.revealIdentity}
          />
        </div>
      )}

      {/* Conversation info footer */}
      {conversationId && (
        <footer className="relative z-10 p-2 border-t border-border/50 text-center">
          <p className="text-xs text-muted-foreground">
            Conversation ID: <code className="bg-muted px-1 rounded">{conversationId}</code>
          </p>
        </footer>
      )}
    </div>
  );
};

interface ChatPanelProps {
  userLabel: string;
  otherUserLabel: string;
  currentUserId: string;
  messages: Message[];
  inputValue: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
  isLoading: boolean;
  hasCurrentUserRevealed: boolean;
  hasOtherUserRevealed: boolean;
  onRevealIdentity: () => void;
}

const ChatPanel = ({
  userLabel,
  otherUserLabel,
  currentUserId,
  messages,
  inputValue,
  onInputChange,
  onSend,
  placeholder,
  isLoading,
  hasCurrentUserRevealed,
  hasOtherUserRevealed,
  onRevealIdentity,
}: ChatPanelProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col min-w-0 border-r border-border/50 last:border-r-0">
      {/* Panel header with identity reveal */}
      <div className="p-3 border-b border-border/50 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-foreground flex items-center gap-2">
              <UserCircle className="w-4 h-4" />
              {userLabel}
            </p>
            <p className="text-xs text-muted-foreground">Your messages appear on the right</p>
          </div>
          <Button
            variant={hasCurrentUserRevealed ? "secondary" : "outline"}
            size="sm"
            onClick={onRevealIdentity}
            disabled={hasCurrentUserRevealed}
            className="text-xs"
          >
            {hasCurrentUserRevealed ? (
              <>
                <Eye className="w-3 h-3 mr-1" />
                Revealed
              </>
            ) : (
              <>
                <EyeOff className="w-3 h-3 mr-1" />
                Reveal Identity
              </>
            )}
          </Button>
        </div>
        {/* Show other user's reveal status */}
        <div className="mt-2 text-xs">
          <span className={hasOtherUserRevealed ? "text-green-400" : "text-muted-foreground"}>
            {hasOtherUserRevealed
              ? `${otherUserLabel} has revealed their identity`
              : `${otherUserLabel} is anonymous`}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No messages yet. Start the conversation!
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUserId;
          const senderLabel = isMe ? userLabel : otherUserLabel;
          const showSenderName = !isMe && hasOtherUserRevealed;
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
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  isMe
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "glass rounded-bl-md"
                }`}
              >
                {!isMe && (
                  <p className="text-xs text-muted-foreground mb-0.5">
                    {showSenderName ? senderLabel : "Anonymous"}
                  </p>
                )}
                <p>{msg.content}</p>
                {time && (
                  <p
                    className={`text-xs mt-1 ${
                      isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {time}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/50 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            placeholder={placeholder}
            className="flex-1 bg-muted rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <Button
            variant="gold"
            size="icon"
            onClick={onSend}
            disabled={!inputValue.trim()}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TestChat;
