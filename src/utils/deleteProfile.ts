/**
 * Safe delete of user profile and all related data.
 * Ensures no orphaned records and doesn't break flow for connected users.
 *
 * Order of deletion (children first):
 * 1. Messages (in conversations involving user)
 * 2. Conversations (involving user)
 * 3. PromAskRequests (involving user)
 * 4. Matches - before delete: update other user's excludeFromDiscovery if isPromDate
 * 5. Likes (involving user)
 * 6. MatchRequests (involving user)
 * 7. UserProfile
 */

import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { logError, logInfo } from "@/utils/logger";
import { GOOGLE_LOGIN_CHECK } from "@/config";

const client = generateClient<Schema>();
const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
const opts = authMode ? { authMode } : undefined;

/** Fetch all pages of a list query */
async function listAllPages<T>(
  fetcher: (nextToken?: string) => Promise<{ data: T[] | null | undefined; nextToken?: string | null }>
): Promise<T[]> {
  const all: T[] = [];
  let nextToken: string | undefined;
  do {
    const result = await fetcher(nextToken);
    if (result.data?.length) all.push(...result.data);
    nextToken = result.nextToken ?? undefined;
  } while (nextToken);
  return all;
}

export async function deleteUserProfile(
  profileId: string,
  userEmail: string
): Promise<{ success: boolean; error?: string }> {
  logInfo("Starting safe profile delete", {
    component: "deleteProfile",
    operation: "deleteUserProfile",
    extra: { profileId },
  });

  try {
    // 1. Get all Matches involving this user
    const [matchesAsUser1, matchesAsUser2] = await Promise.all([
      listAllPages((token) =>
        client.models.Match.listMatchByUser1Id(
          { user1Id: profileId },
          { ...opts, nextToken: token } as any
        )
      ),
      listAllPages((token) =>
        client.models.Match.listMatchByUser2Id(
          { user2Id: profileId },
          { ...opts, nextToken: token } as any
        )
      ),
    ]);

    const matchIds = new Set(matchesAsUser1.map((m) => m.id));
    const allMatches = [
      ...matchesAsUser1,
      ...matchesAsUser2.filter((m) => m.id && !matchIds.has(m.id)),
    ];

    // 2. For each Match with isPromDate: update other user's excludeFromDiscovery = false
    for (const match of allMatches) {
      if (match.isPromDate && match.id) {
        const otherId = match.user1Id === profileId ? match.user2Id : match.user1Id;
        if (otherId) {
          try {
            const { data: otherProfile } = await client.models.UserProfile.get(
              { id: otherId },
              opts
            );
            if (otherProfile?.email) {
              await client.models.UserProfile.update(
                { id: otherId, email: otherProfile.email, excludeFromDiscovery: false },
                opts
              );
              logInfo("Reset excludeFromDiscovery for partner", {
                component: "deleteProfile",
                extra: { otherId },
              });
            }
          } catch (err) {
            logError(err, {
              component: "deleteProfile",
              operation: "updatePartnerExcludeFromDiscovery",
              extra: { otherId },
            });
          }
        }
      }
    }

    // 3. Get all Conversations involving this user
    const [convsAsUser1, convsAsUser2] = await Promise.all([
      listAllPages((token) =>
        client.models.Conversation.listConversationByUser1Id(
          { user1Id: profileId },
          { ...opts, nextToken: token } as any
        )
      ),
      listAllPages((token) =>
        client.models.Conversation.listConversationByUser2Id(
          { user2Id: profileId },
          { ...opts, nextToken: token } as any
        )
      ),
    ]);

    const convIds = new Set(convsAsUser1.map((c) => c.id));
    const allConvs = [
      ...convsAsUser1,
      ...convsAsUser2.filter((c) => c.id && !convIds.has(c.id)),
    ];

    // 4. Delete all Messages in each Conversation, then delete Conversation
    for (const conv of allConvs) {
      if (!conv.id) continue;
      let msgToken: string | undefined;
      do {
        const msgRes = await client.models.Message.listMessageByConversationIdAndSentAt(
          { conversationId: conv.id },
          { ...opts, nextToken: msgToken } as any
        );
        const messages = msgRes.data ?? [];
        for (const msg of messages) {
          if (msg.id) {
            await client.models.Message.delete({ id: msg.id }, opts);
          }
        }
        msgToken = msgRes.nextToken;
      } while (msgToken);

      await client.models.Conversation.delete({ id: conv.id }, opts);
    }

    // 5. Delete PromAskRequests (from or to this user)
    const [promAsksFrom, promAsksTo] = await Promise.all([
      listAllPages((token) =>
        client.models.PromAskRequest.listPromAskRequestByFromUserId(
          { fromUserId: profileId },
          { ...opts, nextToken: token } as any
        )
      ),
      listAllPages((token) =>
        client.models.PromAskRequest.listPromAskRequestByToUserId(
          { toUserId: profileId },
          { ...opts, nextToken: token } as any
        )
      ),
    ]);
    const promAskIds = new Set(promAsksFrom.map((p) => p.id));
    const allPromAsks = [
      ...promAsksFrom,
      ...promAsksTo.filter((p) => p.id && !promAskIds.has(p.id)),
    ];
    for (const pa of allPromAsks) {
      if (pa.id) await client.models.PromAskRequest.delete({ id: pa.id }, opts);
    }

    // 6. Delete Matches
    for (const match of allMatches) {
      if (match.id) await client.models.Match.delete({ id: match.id }, opts);
    }

    // 7. Delete Likes (from or to this user)
    const [likesFrom, likesTo] = await Promise.all([
      listAllPages((token) =>
        client.models.Like.listLikeByFromUserId(
          { fromUserId: profileId },
          { ...opts, nextToken: token } as any
        )
      ),
      listAllPages((token) =>
        client.models.Like.listLikeByToUserId(
          { toUserId: profileId },
          { ...opts, nextToken: token } as any
        )
      ),
    ]);
    const likeIds = new Set(likesFrom.map((l) => l.id));
    const allLikes = [
      ...likesFrom,
      ...likesTo.filter((l) => l.id && !likeIds.has(l.id)),
    ];
    for (const like of allLikes) {
      if (like.id) await client.models.Like.delete({ id: like.id }, opts);
    }

    // 8. Delete MatchRequests (from, to by userId, or to by email)
    const [reqsFrom, reqsToUserId, reqsToEmail] = await Promise.all([
      listAllPages((token) =>
        client.models.MatchRequest.listMatchRequestByFromUserId(
          { fromUserId: profileId },
          { ...opts, nextToken: token } as any
        )
      ),
      listAllPages((token) =>
        client.models.MatchRequest.listMatchRequestByToUserId(
          { toUserId: profileId },
          { ...opts, nextToken: token } as any
        )
      ),
      listAllPages((token) =>
        client.models.MatchRequest.listMatchRequestByToEmail(
          { toEmail: userEmail },
          { ...opts, nextToken: token } as any
        )
      ),
    ]);
    const seenIds = new Set<string>();
    for (const r of [...reqsFrom, ...reqsToUserId, ...reqsToEmail]) {
      if (r.id && !seenIds.has(r.id)) {
        seenIds.add(r.id);
        await client.models.MatchRequest.delete({ id: r.id }, opts);
      }
    }

    // 9. Delete UserProfile
    await client.models.UserProfile.delete({ id: profileId }, opts);

    logInfo("Profile delete completed", {
      component: "deleteProfile",
      operation: "deleteUserProfile",
      extra: { profileId },
    });
    return { success: true };
  } catch (err) {
    logError(err, {
      component: "deleteProfile",
      operation: "deleteUserProfile",
      extra: { profileId },
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete profile",
    };
  }
}
