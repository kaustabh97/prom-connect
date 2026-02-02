import { useCallback, useState } from "react";
import type { DiscoveryProfileFull, SwipeAction } from "@/lib/dating";

const VIEWER_USER_ID = "current-user-id"; // Replace with real auth when enabled

/** In-memory for UX; replace with API (Like/Match models). */
const passedIds = new Set<string>();
const likedIds = new Set<string>();
const matches: { user1Id: string; user2Id: string }[] = [];

export function useMatch() {
  const [tick, setTick] = useState(0);

  const recordSwipe = useCallback(
    (profileId: string, action: SwipeAction) => {
      console.log("[useMatch] recordSwipe called:", {
        profileId,
        action,
        alreadyLiked: likedIds.has(profileId),
        alreadyPassed: passedIds.has(profileId),
      });

      if (action === "like") {
        likedIds.add(profileId);
        console.log("[useMatch] Added to likedIds:", {
          profileId,
          totalLiked: likedIds.size,
          likedIds: Array.from(likedIds),
        });
        // Stub: in real app, check if they already liked us → create match
        matches.push({ user1Id: VIEWER_USER_ID, user2Id: profileId });
        console.log("[useMatch] Created match:", {
          match: { user1Id: VIEWER_USER_ID, user2Id: profileId },
          totalMatches: matches.length,
        });
      } else {
        passedIds.add(profileId);
        console.log("[useMatch] Added to passedIds:", {
          profileId,
          totalPassed: passedIds.size,
          passedIds: Array.from(passedIds),
        });
      }
      console.log("[useMatch] Triggering state update (setTick)");
      setTick((t) => t + 1);
      console.log("[useMatch] recordSwipe complete");
    },
    []
  );

  const hasPassed = useCallback((profileId: string) => {
    const result = passedIds.has(profileId);
    console.log("[useMatch] hasPassed:", { profileId, result });
    return result;
  }, []);
  const hasLiked = useCallback((profileId: string) => {
    const result = likedIds.has(profileId);
    console.log("[useMatch] hasLiked:", { profileId, result });
    return result;
  }, []);
  const getMatches = useCallback(() => [...matches], []);

  return { recordSwipe, hasPassed, hasLiked, getMatches, viewerUserId: VIEWER_USER_ID, tick };
}
