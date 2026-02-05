import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY_PREFIX = "prom-connect:viewed-matches:";
const VIEWED_UPDATED_EVENT = "prom-connect:viewed-matches-updated";

function loadViewedMatchIds(userId: string): Set<string> {
  if (!userId) return new Set();
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveViewedMatchIds(userId: string, ids: Set<string>) {
  if (!userId) return;
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${userId}`,
      JSON.stringify([...ids])
    );
  } catch {
    // ignore
  }
}

interface UseViewedMatchesReturn {
  viewedMatchIds: Set<string>;
  markMatchViewed: (matchId: string) => void;
}

export function useViewedMatches(userId: string): UseViewedMatchesReturn {
  const [viewedMatchIds, setViewedMatchIds] = useState<Set<string>>(() =>
    loadViewedMatchIds(userId)
  );

  useEffect(() => {
    setViewedMatchIds(loadViewedMatchIds(userId));
  }, [userId]);

  // Listen for updates from other components (e.g. Matches marks viewed, BottomNav needs to update)
  useEffect(() => {
    const handler = () => {
      if (userId) setViewedMatchIds(loadViewedMatchIds(userId));
    };
    window.addEventListener(VIEWED_UPDATED_EVENT, handler);
    return () => window.removeEventListener(VIEWED_UPDATED_EVENT, handler);
  }, [userId]);

  const markMatchViewed = useCallback(
    (matchId: string) => {
      if (!matchId || !userId) return;
      const next = new Set(loadViewedMatchIds(userId));
      if (next.has(matchId)) return;
      next.add(matchId);
      saveViewedMatchIds(userId, next);
      window.dispatchEvent(new CustomEvent(VIEWED_UPDATED_EVENT));
    },
    [userId]
  );

  return { viewedMatchIds, markMatchViewed };
}
