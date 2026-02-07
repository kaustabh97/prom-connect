/**
 * Unmatch two users: delete the Match, their Conversation and Messages,
 * reset both profiles (excludeFromDiscovery, partner fields if prom date).
 * Optionally update current user with WithdrawFormData when switching from prom date to discovery.
 */

import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { logError, logInfo } from "@/utils/logger";
import { GOOGLE_LOGIN_CHECK } from "@/config";
import type { WithdrawFormData } from "@/components/WithdrawModal";

const client = generateClient<Schema>();
const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
const opts = authMode ? { authMode } : undefined;

export interface UnmatchOptions {
  matchId: string;
  currentUserId: string;
  otherUserId: string;
  isPromDate: boolean;
  /** When unmatching from prom date, pass form data to update current user for discovery flow */
  currentUserFormData?: WithdrawFormData;
}

async function deleteConversationAndMessages(conversationId: string): Promise<void> {
  let msgToken: string | undefined;
  do {
    const msgRes = await client.models.Message.listMessageByConversationIdAndSentAt(
      { conversationId },
      { ...opts, nextToken: msgToken } as { authMode?: "apiKey"; nextToken?: string }
    );
    const messages = msgRes.data ?? [];
    for (const msg of messages) {
      if (msg.id) await client.models.Message.delete({ id: msg.id }, opts);
    }
    msgToken = msgRes.nextToken ?? undefined;
  } while (msgToken);
  await client.models.Conversation.delete({ id: conversationId }, opts);
}

/**
 * Reset a user's profile for discovery (clear partner fields, set excludeFromDiscovery false).
 * If formData is provided (for current user only), also set sexualOrientation, intention, hometown, foodPreference.
 */
export async function resetProfileForDiscovery(
  profileId: string,
  formData?: WithdrawFormData
): Promise<void> {
  const { data: profile } = await client.models.UserProfile.get({ id: profileId }, opts);
  if (!profile?.id || !profile.email) return;
  const updatePayload: Record<string, unknown> = {
    id: profile.id,
    email: profile.email,
    bio: undefined,
    partnerStatus: "Still looking for my prom date 💫",
    partnerEmail: "",
    partnerName: "",
    excludeFromDiscovery: false,
    onboardingCompleted: true,
  };
  if (formData) {
    updatePayload.sexualOrientation = formData.sexualOrientation;
    updatePayload.intention = formData.intention;
    updatePayload.hometown = formData.hometown;
    updatePayload.foodPreference = "Flexible";
  }
  await client.models.UserProfile.update(updatePayload as Parameters<typeof client.models.UserProfile.update>[0], opts);
}

/**
 * Unmatch two users. Deletes Match, Conversation, Messages; resets both profiles.
 * For prom date: both get partner fields cleared; current user can get form data for discovery.
 */
export async function unmatchUsers(options: UnmatchOptions): Promise<{ success: boolean; error?: string }> {
  const { matchId, currentUserId, otherUserId, isPromDate, currentUserFormData } = options;
  logInfo("Unmatching users", {
    component: "unmatch",
    operation: "unmatchUsers",
    extra: { matchId, currentUserId, otherUserId, isPromDate },
  });

  try {
    const { data: match } = await client.models.Match.get({ id: matchId }, opts);
    if (!match?.id) {
      return { success: false, error: "Match not found" };
    }

    const conversationId = match.conversationId ?? undefined;
    if (conversationId) {
      await deleteConversationAndMessages(conversationId);
    }

    // Delete PromAskRequests for this match
    const [fromMe, toMe] = await Promise.all([
      client.models.PromAskRequest.listPromAskRequestByFromUserId(
        { fromUserId: currentUserId },
        opts
      ),
      client.models.PromAskRequest.listPromAskRequestByToUserId(
        { toUserId: currentUserId },
        opts
      ),
    ]);
    const allPromAsks = [...(fromMe.data ?? []), ...(toMe.data ?? [])].filter(
      (p) => p.matchId === matchId
    );
    for (const pa of allPromAsks) {
      if (pa.id) await client.models.PromAskRequest.delete({ id: pa.id }, opts);
    }

    await client.models.Match.delete({ id: matchId }, opts);

    if (isPromDate) {
      await resetProfileForDiscovery(otherUserId);
      await resetProfileForDiscovery(currentUserId, currentUserFormData);
    } else {
      // Regular match: just ensure both are not excluded from discovery
      const [cur, other] = await Promise.all([
        client.models.UserProfile.get({ id: currentUserId }, opts),
        client.models.UserProfile.get({ id: otherUserId }, opts),
      ]);
      if (cur?.id && cur.email)
        await client.models.UserProfile.update(
          { id: cur.id, email: cur.email, excludeFromDiscovery: false },
          opts
        );
      if (other?.id && other.email)
        await client.models.UserProfile.update(
          { id: other.id, email: other.email, excludeFromDiscovery: false },
          opts
        );
    }

    logInfo("Unmatch completed", { component: "unmatch", operation: "unmatchUsers", extra: { matchId } });
    return { success: true };
  } catch (err) {
    logError(err, { component: "unmatch", operation: "unmatchUsers", extra: { matchId } });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to unmatch",
    };
  }
}
