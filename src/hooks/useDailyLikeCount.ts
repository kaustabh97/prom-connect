import { useState, useEffect, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { logError, logInfo } from "@/utils/logger";
import {
  DAILY_LIKE_LIMIT,
  hasDailyLikeLimit,
  isWithinTodayIST,
} from "@/lib/dailyLikes";
import { GOOGLE_LOGIN_CHECK } from "@/config";

const client = generateClient<Schema>();

export interface DailyLikeInfo {
  /** Number of likes used today (IST). Null if user has no limit. */
  count: number | null;
  /** Daily limit (10 for men). Null if unlimited. */
  limit: number | null;
  /** Remaining likes today. Null if unlimited. */
  remaining: number | null;
  /** True if user has a daily limit (men). */
  hasLimit: boolean;
  /** True when limit is reached. */
  atLimit: boolean;
}

/**
 * Fetches and returns the current user's daily like count (IST).
 * Men: count today's likes from backend, return count/limit/remaining.
 * Women and non-binary: return hasLimit=false, count/limit/remaining=null.
 *
 * @param profileId - Current user's UserProfile id
 * @param gender - Current user's gender ("Man" | "Woman" | "Non-Binary")
 * @param refreshDeps - Increment to trigger refetch (e.g. after recording a like)
 */
export function useDailyLikeCount(
  profileId: string | null,
  gender: string | undefined | null,
  refreshDeps: number
): DailyLikeInfo {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const hasLimit = hasDailyLikeLimit(gender);

  const fetchCount = useCallback(async () => {
    if (!profileId || !hasLimit) {
      setCount(null);
      return;
    }
    setLoading(true);
    logInfo("Fetching daily like count", {
      component: "useDailyLikeCount",
      operation: "fetchCount",
      extra: { profileId },
    });
    try {
      const opts = !GOOGLE_LOGIN_CHECK ? { authMode: "apiKey" as const } : undefined;
      const { data: likes } = await client.models.Like.list(
        { filter: { fromUserId: { eq: profileId } } },
        opts
      );
      const todayCount =
        likes?.filter((like) => isWithinTodayIST(like.createdAt)).length ?? 0;
      setCount(todayCount);
      logInfo("Daily like count loaded", {
        component: "useDailyLikeCount",
        operation: "fetchCount",
        extra: { count: todayCount, limit: DAILY_LIKE_LIMIT },
      });
    } catch (err) {
      logError(err, { component: "useDailyLikeCount", operation: "fetchCount" });
      setCount(null);
    } finally {
      setLoading(false);
    }
  }, [profileId, hasLimit]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount, refreshDeps]);

  if (!hasLimit) {
    return {
      count: null,
      limit: null,
      remaining: null,
      hasLimit: false,
      atLimit: false,
    };
  }

  const c = count ?? 0;
  return {
    count: c,
    limit: DAILY_LIKE_LIMIT,
    remaining: Math.max(0, DAILY_LIKE_LIMIT - c),
    hasLimit: true,
    atLimit: c >= DAILY_LIKE_LIMIT,
  };
}
