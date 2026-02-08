import { useState, useEffect } from "react";
import { getMatchmakingEnabled, MATCHMAKING_GO_LIVE_DATE } from "@/config";

/**
 * Reactive matchmaking enabled flag. Re-renders when we cross the go-live time on main.
 */
export function useMatchmakingEnabled(): boolean {
  const [enabled, setEnabled] = useState(getMatchmakingEnabled);

  useEffect(() => {
    if (enabled) return;
    const goLiveMs = new Date(MATCHMAKING_GO_LIVE_DATE).getTime();
    const delay = Math.max(0, goLiveMs - Date.now());
    if (delay === 0) {
      setEnabled(true);
      return;
    }
    const t = setTimeout(() => setEnabled(getMatchmakingEnabled()), delay);
    return () => clearTimeout(t);
  }, [enabled]);

  return enabled;
}
