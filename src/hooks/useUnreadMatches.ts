import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY_PREFIX = "prom-connect:unread-matches:";
const UNREAD_UPDATED_EVENT = "prom-connect:unread-matches-updated";

function loadUnreadMatchIds(userId: string): Set<string> {
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

function saveUnreadMatchIds(userId: string, ids: Set<string>) {
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

export function dispatchUnreadUpdated(): void {
  window.dispatchEvent(new CustomEvent(UNREAD_UPDATED_EVENT));
}

interface UseUnreadMatchesReturn {
  unreadMatchIds: Set<string>;
  addUnread: (matchId: string) => void;
  clearUnread: (matchId: string) => void;
}

export function useUnreadMatches(userId: string): UseUnreadMatchesReturn {
  const [unreadMatchIds, setUnreadMatchIds] = useState<Set<string>>(() =>
    loadUnreadMatchIds(userId)
  );

  useEffect(() => {
    setUnreadMatchIds(loadUnreadMatchIds(userId));
  }, [userId]);

  useEffect(() => {
    const handler = () => {
      if (userId) setUnreadMatchIds(loadUnreadMatchIds(userId));
    };
    window.addEventListener(UNREAD_UPDATED_EVENT, handler);
    return () => window.removeEventListener(UNREAD_UPDATED_EVENT, handler);
  }, [userId]);

  const addUnread = useCallback(
    (matchId: string) => {
      if (!matchId || !userId) return;
      const next = new Set(loadUnreadMatchIds(userId));
      if (next.has(matchId)) return;
      next.add(matchId);
      saveUnreadMatchIds(userId, next);
      dispatchUnreadUpdated();
    },
    [userId]
  );

  const clearUnread = useCallback(
    (matchId: string) => {
      if (!matchId || !userId) return;
      const next = new Set(loadUnreadMatchIds(userId));
      if (!next.has(matchId)) return;
      next.delete(matchId);
      saveUnreadMatchIds(userId, next);
      dispatchUnreadUpdated();
    },
    [userId]
  );

  return { unreadMatchIds, addUnread, clearUnread };
}
