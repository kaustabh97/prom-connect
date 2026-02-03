import { useCallback, useState } from "react";
import type { SwipeAction } from "@/lib/dating";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { getUserProfile } from "@/utils/auth";
import { GOOGLE_LOGIN_CHECK } from "@/config";

const client = generateClient<Schema>();

/** In-memory for UX (passes + likes); likes persisted to backend */
const passedIds = new Set<string>();
const likedIds = new Set<string>();
const matches: { user1Id: string; user2Id: string }[] = [];

export type RecordSwipeResult = { isMatch: boolean; matchId?: string };

export function useMatch() {
  const [tick, setTick] = useState(0);

  /**
   * Load likes from backend (profiles the current user has already liked).
   * Call on Discover mount so we exclude them from the feed.
   */
  const loadLikesFromBackend = useCallback(async (): Promise<void> => {
    try {
      const authProfile = await getUserProfile();
      if (!authProfile?.email) return;

      const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
      const opts = authMode ? { authMode } : undefined;

      // Load current user's UserProfile to get the backend id
      const { data: profiles } =
        // @ts-ignore - authMode option not in types yet
        await client.models.UserProfile.list(
          { filter: { email: { eq: authProfile.email } } },
          opts
        );
      const currentUserProfile = profiles?.[0];
      if (!currentUserProfile?.id) return;

      // Fetch Likes where fromUserId = current user (who we've liked)
      // @ts-ignore - filter type
      const { data: likes } =
        await client.models.Like.list(
          { filter: { fromUserId: { eq: currentUserProfile.id } } },
          opts
        );
      if (likes) {
        likes.forEach((like) => {
          if (like.toUserId) likedIds.add(like.toUserId);
        });
        console.log("[useMatch] Loaded likes from backend:", likes.length, Array.from(likedIds));
      }
    } catch (err) {
      console.error("[useMatch] Failed to load likes from backend:", err);
    }
  }, []);

  const recordSwipe = useCallback(
    async (profileId: string, action: SwipeAction): Promise<RecordSwipeResult> => {
      const result: RecordSwipeResult = { isMatch: false };

      if (action === "like") {
        likedIds.add(profileId);
        let fromUserId = "unknown";

        try {
          const authProfile = await getUserProfile();
          if (!authProfile?.email) {
            console.warn("[useMatch] No authenticated user, skipping backend Like create");
          } else {
            const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
            const opts = authMode ? { authMode } : undefined;

            const { data: profiles } =
              // @ts-ignore - authMode
              await client.models.UserProfile.list(
                { filter: { email: { eq: authProfile.email } } },
                opts
              );
            const currentUserProfile = profiles?.[0];
            if (currentUserProfile?.id) {
              fromUserId = currentUserProfile.id;
              const currentUserEmail = currentUserProfile.email ?? authProfile.email;

              // Fetch liked user's profile for email metadata
              const { data: likedProfile } =
                // @ts-ignore - authMode
                await client.models.UserProfile.get({ id: profileId }, opts);
              const likedUserEmail = likedProfile?.email;

              // Create Like
              // @ts-ignore - authMode type
              await client.models.Like.create({ fromUserId, toUserId: profileId }, opts);
              console.log("[useMatch] Like saved to backend:", { fromUserId, toUserId: profileId });

              // Check if the other person has already liked us (mutual like → match)
              // Query: likes FROM profileId (people they liked), filter for toUserId = us
              // @ts-ignore - filter type
              const { data: theirLikes } =
                await client.models.Like.list(
                  { filter: { fromUserId: { eq: profileId } } },
                  opts
                );
              const mutualLike =
                theirLikes?.some((like) => like.toUserId === fromUserId) ?? false;
              if (mutualLike) {
                result.isMatch = true;
                // Create Match record
                const u1 = fromUserId;
                const u2 = profileId;
                // @ts-ignore - authMode type
                const { data: matchData } = await client.models.Match.create(
                  {
                    user1Id: u1,
                    user2Id: u2,
                    user1Email: currentUserEmail,
                    user2Email: likedUserEmail,
                    status: "active",
                    createdAt: new Date().toISOString(),
                  },
                  opts
                );
                if (matchData?.id) {
                  result.matchId = matchData.id;
                }
                console.log("[useMatch] Mutual like! Match created:", { user1Id: u1, user2Id: u2, matchId: matchData?.id });
              }
            }
          }
        } catch (err) {
          console.error("[useMatch] Failed to save like/match to backend:", err);
        }

        matches.push({ user1Id: fromUserId, user2Id: profileId });
      } else {
        passedIds.add(profileId);
      }

      setTick((t) => t + 1);
      return result;
    },
    []
  );

  const hasPassed = useCallback((profileId: string) => passedIds.has(profileId), []);
  const hasLiked = useCallback((profileId: string) => likedIds.has(profileId), []);
  const getMatches = useCallback(() => [...matches], []);

  return {
    recordSwipe,
    loadLikesFromBackend,
    hasPassed,
    hasLiked,
    getMatches,
    viewerUserId: "current-user",
    tick,
  };
}
