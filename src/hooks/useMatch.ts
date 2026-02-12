import { useCallback, useState } from "react";
import type { SwipeAction } from "@/lib/dating";
import { generateClient } from "aws-amplify/data";
import { logError, logInfo } from "@/utils/logger";
import type { Schema } from "../../amplify/data/resource";
import { getUserProfileFromCognito } from "@/utils/auth";
import { getIdFromEmail } from "@/utils/userId";
import { GOOGLE_LOGIN_CHECK } from "@/config";

const client = generateClient<Schema>();

/** In-memory for UX (passes + likes); likes and passes are persisted to backend. */
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
    logInfo("Loading likes from backend", { component: "useMatch", operation: "loadLikesFromBackend" });
    try {
      const authProfile = await getUserProfileFromCognito();
      if (!authProfile?.email) return;

      const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
      const opts = authMode ? { authMode } : undefined;

      const profileId = getIdFromEmail(authProfile.email.trim());
      const { data: currentUserProfile } = await client.models.UserProfile.get(
        { id: profileId },
        opts
      );
      if (!currentUserProfile?.id) return;

      // Fetch all Likes where fromUserId = current user (paginate to get full list)
      let allLikes: { toUserId?: string | null }[] = [];
      let nextToken: string | undefined;
      do {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (client.models.Like as any).list(
          { filter: { fromUserId: { eq: currentUserProfile.id } }, nextToken },
          opts
        );
        const page = result.data ?? [];
        allLikes = allLikes.concat(page);
        nextToken = result.nextToken ?? undefined;
      } while (nextToken);
      if (allLikes.length > 0) {
        allLikes.forEach((like) => {
          if (like.toUserId) likedIds.add(like.toUserId);
        });
        logInfo("Likes loaded from backend", {
          component: "useMatch",
          operation: "loadLikesFromBackend",
          extra: { count: allLikes.length },
        });
      }

      // Fetch all Passes (skips) where fromUserId = current user (paginate to get full list)
      let allPasses: { toUserId?: string | null }[] = [];
      let passNextToken: string | undefined;
      do {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (client.models.Pass as any).list(
          { filter: { fromUserId: { eq: currentUserProfile.id } }, nextToken: passNextToken },
          opts
        );
        const page = result.data ?? [];
        allPasses = allPasses.concat(page);
        passNextToken = result.nextToken ?? undefined;
      } while (passNextToken);
      if (allPasses.length > 0) {
        allPasses.forEach((pass) => {
          if (pass.toUserId) passedIds.add(pass.toUserId);
        });
        logInfo("Passes loaded from backend", {
          component: "useMatch",
          operation: "loadLikesFromBackend",
          extra: { count: allPasses.length },
        });
      }
    } catch (err) {
      logError(err, { component: "useMatch", operation: "loadLikes" });
    }
  }, []);

  const recordSwipe = useCallback(
    async (profileId: string, action: SwipeAction): Promise<RecordSwipeResult> => {
      const result: RecordSwipeResult = { isMatch: false };

      if (action === "like") {
        logInfo("Recording like", { component: "useMatch", operation: "recordSwipe", extra: { profileId } });
        likedIds.add(profileId);
        let fromUserId = "unknown";

        try {
          const authProfile = await getUserProfileFromCognito();
          if (authProfile?.email) {
            const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
            const opts = authMode ? { authMode } : undefined;

            const currentUserProfileId = getIdFromEmail(authProfile.email.trim());
            const { data: currentUserProfile } = await client.models.UserProfile.get(
              { id: currentUserProfileId },
              opts
            );
            if (currentUserProfile?.id) {
              fromUserId = currentUserProfile.id;
              const currentUserEmail = currentUserProfile.email ?? authProfile.email;

              // Fetch liked user's profile for email metadata (profileId = liked profile)
              const { data: likedProfile } =
                // @ts-ignore - authMode
                await client.models.UserProfile.get({ id: profileId }, opts);
              const likedUserEmail = likedProfile?.email;

              // Create Like (profileId = liked profile's id)
              // @ts-ignore - authMode type
              await client.models.Like.create({ fromUserId, toUserId: profileId }, opts);

              // Check if the other person has already liked us (mutual like → match)
              // Query: likes FROM profileId (people they liked), filter for toUserId = us
              // Paginate to check all their likes
              let mutualLike = false;
              let likeNextToken: string | undefined;
              do {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: theirLikes, nextToken } = await (client.models.Like as any).list(
                  { filter: { fromUserId: { eq: profileId } }, nextToken: likeNextToken },
                  opts
                );
                if (theirLikes?.some((like) => like.toUserId === fromUserId)) {
                  mutualLike = true;
                  break; // Found mutual like, no need to continue
                }
                likeNextToken = nextToken ?? undefined;
              } while (likeNextToken && !mutualLike);
              if (mutualLike) {
                logInfo("Mutual like - creating match", { component: "useMatch", operation: "recordSwipe", extra: { profileId } });
                result.isMatch = true;
                // Create Match record (profileId = liked profile)
                const u1 = fromUserId;
                const u2 = profileId;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: matchData } = await (client.models.Match as any).create(
                  {
                    user1Id: u1,
                    user2Id: u2,
                    user1Email: currentUserEmail ?? undefined,
                    user2Email: likedUserEmail ?? undefined,
                    status: "active",
                    createdAt: new Date().toISOString(),
                  },
                  opts
                );
                if (matchData?.id) {
                  result.matchId = matchData.id;
                }
              }
            }
          }
        } catch (err) {
          logError(err, { component: "useMatch", operation: "saveLikeMatch", extra: { profileId } });
        }

        matches.push({ user1Id: fromUserId, user2Id: profileId });
      } else {
        logInfo("Recording pass", {
          component: "useMatch",
          operation: "recordSwipe",
          extra: { profileId },
        });
        passedIds.add(profileId);
        try {
          const authProfile = await getUserProfileFromCognito();
          if (authProfile?.email) {
            const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
            const opts = authMode ? { authMode } : undefined;
            const currentUserProfileId = getIdFromEmail(authProfile.email.trim());
            const { data: currentUserProfile } = await client.models.UserProfile.get(
              { id: currentUserProfileId },
              opts
            );
            if (currentUserProfile?.id) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (client.models.Pass as any).create(
                { fromUserId: currentUserProfile.id, toUserId: profileId },
                opts
              );
            }
          }
        } catch (err) {
          logError(err, { component: "useMatch", operation: "savePass", extra: { profileId } });
        }
      }

      setTick((t) => t + 1);
      return result;
    },
    []
  );

  const hasPassed = useCallback((profileId: string) => passedIds.has(profileId), []);
  const hasLiked = useCallback((profileId: string) => likedIds.has(profileId), []);
  const getPassedIds = useCallback(() => new Set(passedIds), []);
  const getMatches = useCallback(() => [...matches], []);

  return {
    recordSwipe,
    loadLikesFromBackend,
    hasPassed,
    hasLiked,
    getPassedIds,
    getMatches,
    viewerUserId: "current-user",
    tick,
  };
}
