import { useCallback, useState } from "react";
import type { DiscoveryProfileFull, SwipeAction } from "@/lib/dating";

const VIEWER_USER_ID = "current-user-id"; // Replace with real auth when enabled

/** In-memory for UX; replace with API (Like/Match models). */
const passedIds = new Set<string>();
const likedIds = new Set<string>();
const matches: { user1Id: string; user2Id: string }[] = [];

export function useMatch() {
  const [, setTick] = useState(0);

  const recordSwipe = useCallback(
    (profileId: string, action: SwipeAction) => {
      if (action === "like") {
        likedIds.add(profileId);
        // Stub: in real app, check if they already liked us → create match
        matches.push({ user1Id: VIEWER_USER_ID, user2Id: profileId });
      } else {
        passedIds.add(profileId);
      }
      setTick((t) => t + 1);
    },
    []
  );

  const hasPassed = useCallback((profileId: string) => passedIds.has(profileId), []);
  const hasLiked = useCallback((profileId: string) => likedIds.has(profileId), []);
  const getMatches = useCallback(() => [...matches], []);

  return { recordSwipe, hasPassed, hasLiked, getMatches, viewerUserId: VIEWER_USER_ID };
}
