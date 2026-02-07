import { useState, useEffect, useCallback, useRef } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { logError, logInfo } from "@/utils/logger";

const client = generateClient<Schema>();

// Types derived from the schema
type Conversation = Schema["Conversation"]["type"];
type Message = Schema["Message"]["type"];

interface UseChatOptions {
  conversationId?: string;
  currentUserId: string;
}

interface UseChatReturn {
  // Conversation state
  conversation: Conversation | null;
  isLoading: boolean;
  error: string | null;

  // Messages
  messages: Message[];
  messagesLoading: boolean;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  revealIdentity: () => Promise<void>;
  createConversation: (otherUserId: string) => Promise<Conversation | null>;
  loadConversation: (id: string) => Promise<void>;

  // Identity reveal status
  hasCurrentUserRevealed: boolean;
  hasOtherUserRevealed: boolean;
}

export function useChat({ conversationId, currentUserId }: UseChatOptions): UseChatReturn {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine if current user is user1 or user2 in the conversation
  const isUser1 = conversation?.user1Id === currentUserId;

  // Identity reveal status
  const hasCurrentUserRevealed = isUser1
    ? conversation?.user1Revealed ?? false
    : conversation?.user2Revealed ?? false;

  const hasOtherUserRevealed = isUser1
    ? conversation?.user2Revealed ?? false
    : conversation?.user1Revealed ?? false;

  // Load a conversation by ID
  const loadConversation = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    logInfo("Loading conversation", { component: "useChat", operation: "loadConversation", extra: { conversationId: id } });
    try {
      const { data, errors } = await client.models.Conversation.get({ id });
      if (errors) {
        logError(errors[0], { component: "useChat", operation: "loadConversation", extra: { conversationId: id, errors } });
        setError(errors[0]?.message || "Failed to load conversation");
        return;
      }
      setConversation(data);
      logInfo("Conversation loaded", { component: "useChat", operation: "loadConversation", extra: { conversationId: id } });
    } catch (err) {
      logError(err, { component: "useChat", operation: "loadConversation", extra: { conversationId: id } });
      setError(err instanceof Error ? err.message : "Failed to load conversation");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load messages for the current conversation
  const loadMessages = useCallback(async (convId: string) => {
    setMessagesLoading(true);
    logInfo("Loading messages", { component: "useChat", operation: "loadMessages", extra: { conversationId: convId } });
    try {
      const { data, errors } = await client.models.Message.listMessageByConversationIdAndSentAt(
        { conversationId: convId },
        { sortDirection: "ASC" }
      );
      if (errors) {
        logError(errors[0], { component: "useChat", operation: "loadMessages", extra: { conversationId: convId, errors } });
        return;
      }
      setMessages(data || []);
      logInfo("Messages loaded", { component: "useChat", operation: "loadMessages", extra: { conversationId: convId, count: (data || []).length } });
    } catch (err) {
      logError(err, { component: "useChat", operation: "loadMessages", extra: { conversationId: convId } });
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // Create a new conversation between current user and another user
  const createConversation = useCallback(async (otherUserId: string): Promise<Conversation | null> => {
    setIsLoading(true);
    setError(null);
    logInfo("Creating conversation", { component: "useChat", operation: "createConversation", extra: { currentUserId, otherUserId } });
    try {
      const { data, errors } = await client.models.Conversation.create({
        user1Id: currentUserId,
        user2Id: otherUserId,
        user1Revealed: false,
        user2Revealed: false,
        lastMessageAt: new Date().toISOString(),
      });
      if (errors) {
        logError(errors[0], { component: "useChat", operation: "createConversation", extra: { currentUserId, otherUserId, errors } });
        setError(errors[0]?.message || "Failed to create conversation");
        return null;
      }
      setConversation(data);
      logInfo("Conversation created", { component: "useChat", operation: "createConversation", extra: { conversationId: data?.id } });
      return data;
    } catch (err) {
      logError(err, { component: "useChat", operation: "createConversation", extra: { currentUserId, otherUserId } });
      setError(err instanceof Error ? err.message : "Failed to create conversation");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  // Send a message in the current conversation
  const sendMessage = useCallback(async (content: string) => {
    if (!conversation?.id) {
      setError("No conversation selected");
      return;
    }
    logInfo("Sending message", { component: "useChat", operation: "sendMessage", extra: { conversationId: conversation.id } });
    try {
      const now = new Date().toISOString();
      const { errors } = await client.models.Message.create({
        conversationId: conversation.id,
        senderId: currentUserId,
        content: content.trim(),
        sentAt: now,
      });
      if (errors) {
        logError(errors[0], { component: "useChat", operation: "sendMessage", extra: { conversationId: conversation.id, errors } });
        return;
      }
      // Update lastMessageAt on conversation
      await client.models.Conversation.update({
        id: conversation.id,
        lastMessageAt: now,
      });
    } catch (err) {
      logError(err, { component: "useChat", operation: "sendMessage", extra: { conversationId: conversation.id } });
    }
  }, [conversation?.id, currentUserId]);

  // Reveal identity to the other user
  const revealIdentity = useCallback(async () => {
    if (!conversation?.id) {
      setError("No conversation selected");
      return;
    }
    logInfo("Revealing identity", { component: "useChat", operation: "revealIdentity", extra: { conversationId: conversation.id } });
    try {
      const updateData = isUser1
        ? { id: conversation.id, user1Revealed: true }
        : { id: conversation.id, user2Revealed: true };

      const { data, errors } = await client.models.Conversation.update(updateData);
      if (errors) {
        logError(errors[0], { component: "useChat", operation: "revealIdentity", extra: { conversationId: conversation.id, errors } });
        return;
      }
      setConversation(data);
      logInfo("Identity revealed", { component: "useChat", operation: "revealIdentity", extra: { conversationId: conversation.id } });
    } catch (err) {
      logError(err, { component: "useChat", operation: "revealIdentity", extra: { conversationId: conversation.id } });
    }
  }, [conversation?.id, isUser1]);

  // Load conversation when conversationId changes
  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    }
  }, [conversationId, loadConversation]);

  // Load messages when conversation is loaded
  useEffect(() => {
    if (conversation?.id) {
      loadMessages(conversation.id);
    }
  }, [conversation?.id, loadMessages]);

  // Track seen message IDs to prevent duplicates (using ref to avoid effect re-runs)
  const seenMessageIds = useRef<Set<string>>(new Set());

  // Update seen IDs when messages change
  useEffect(() => {
    messages.forEach(m => seenMessageIds.current.add(m.id));
  }, [messages]);

  // Subscribe to new messages in real-time
  useEffect(() => {
    if (!conversation?.id) return;

    const subscription = client.models.Message.onCreate({
      filter: { conversationId: { eq: conversation.id } },
    }).subscribe({
      next: (newMessage) => {
        // Avoid duplicates using ref
        if (seenMessageIds.current.has(newMessage.id)) return;
        seenMessageIds.current.add(newMessage.id);
        
        setMessages((prev) => {
          // Double-check in state as well
          if (prev.some((m) => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
      },
      error: (err) => {
        logError(err, { component: "useChat", operation: "messageSubscription", extra: { conversationId: conversation.id } });
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [conversation?.id]);

  // Subscribe to conversation updates (for identity reveal)
  useEffect(() => {
    if (!conversation?.id) return;

    const subscription = client.models.Conversation.onUpdate({
      filter: { id: { eq: conversation.id } },
    }).subscribe({
      next: (updatedConversation) => {
        setConversation(updatedConversation);
      },
      error: (err) => {
        logError(err, { component: "useChat", operation: "conversationSubscription", extra: { conversationId: conversation.id } });
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [conversation?.id]);

  return {
    conversation,
    isLoading,
    error,
    messages,
    messagesLoading,
    sendMessage,
    revealIdentity,
    createConversation,
    loadConversation,
    hasCurrentUserRevealed,
    hasOtherUserRevealed,
  };
}

// Helper hook to list all conversations for a user
export function useConversationList(userId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    logInfo("Loading conversations", { component: "useConversationList", operation: "loadConversations", extra: { userId } });
    try {
      // Get conversations where user is user1
      const { data: asUser1 } = await client.models.Conversation.listConversationByUser1Id({
        user1Id: userId,
      });
      // Get conversations where user is user2
      const { data: asUser2 } = await client.models.Conversation.listConversationByUser2Id({
        user2Id: userId,
      });

      // Combine and sort by lastMessageAt
      const all = [...(asUser1 || []), ...(asUser2 || [])];
      all.sort((a, b) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return timeB - timeA; // Most recent first
      });
      setConversations(all);
      logInfo("Conversations loaded", { component: "useConversationList", operation: "loadConversations", extra: { userId, count: all.length } });
    } catch (err) {
      logError(err, { component: "useConversationList", operation: "loadConversations", extra: { userId } });
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return { conversations, isLoading, refresh: loadConversations };
}
