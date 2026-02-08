/**
 * Discovery feed scoring and ordering.
 * - Backend (Lambda) computes: email-name match, age sanity, popularity, completeness, recency
 *   → discoveryScore on UserProfile (global, not per-viewer).
 * - At runtime we personalize for the logged-in user: filter by their preferences (gender),
 *   then sort by a combined score that includes compatibility with their preferences (cohort,
 *   intention) so the feed reflects both global quality and fit with the current user.
 */

import type { DiscoveryProfileFull, DiscoveryFilters } from "./dating";

/** Weight for global discovery score vs preference match (0–1). Higher = preference match matters more. */
const PREFERENCE_MATCH_WEIGHT = 0.35;

/** Age above this is considered unrealistic for discovery (down-rank or exclude from score). */
export const MAX_REALISTIC_AGE = 60;

/** Normalize gender for comparison (same as dating.ts). */
function normalizeGender(g: string): string {
  const lower = (g || "").trim().toLowerCase();
  if (lower === "woman" || lower === "man") return lower.charAt(0).toUpperCase() + lower.slice(1);
  if (lower === "non-binary" || lower === "nonbinary") return "Non-Binary";
  return g;
}

/**
 * Preference match score 0–1: how well the profile matches the viewer's preferences (cohort, intention).
 * Gender is already enforced by filters; this ranks within the filtered set.
 */
export function preferenceMatchScore(
  profile: DiscoveryProfileFull,
  filters: DiscoveryFilters
): number {
  let score = 0;
  let factors = 0;

  if (filters.preferredCohorts.length > 0) {
    factors += 1;
    if (profile.cohort && filters.preferredCohorts.includes(profile.cohort)) {
      score += 1;
    }
  }

  if (filters.preferredIntention != null && filters.preferredIntention !== "") {
    factors += 1;
    if (profile.intention && profile.intention === filters.preferredIntention) {
      score += 1;
    }
  }

  if (factors === 0) return 1;
  return score / factors;
}

/**
 * Whether the profile has a realistic age for discovery (≤ MAX_REALISTIC_AGE).
 */
export function isRealisticAge(age: number | null | undefined): boolean {
  if (age == null) return true;
  return age <= MAX_REALISTIC_AGE;
}

/** Per-viewer exploration value 0–1 so tie-breaker order differs per user (no same order for everyone). */
function explorationSeed(profileId: string, viewerId?: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const s = viewerId ? today + profileId + viewerId : today + profileId;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

/**
 * Combined score (0–1) for the logged-in viewer: blends global discoveryScore with
 * how well the profile matches the viewer's preferences (cohort, intention).
 * Used so the feed is personalized at runtime for the current user.
 */
export function effectiveDiscoveryScore(
  profile: DiscoveryProfileFull,
  filters: DiscoveryFilters
): number {
  const global = Math.max(0, Math.min(1, profile.discoveryScore ?? 0));
  const pref = preferenceMatchScore(profile, filters);
  return global * (1 - PREFERENCE_MATCH_WEIGHT) + pref * PREFERENCE_MATCH_WEIGHT;
}

/**
 * Sort discovery profiles for the logged-in viewer. Order is personalized per user:
 * - effectiveScore blends global discoveryScore with this viewer's preference match (cohort, intention)
 * - liked-me boost is per viewer
 * - exploration tie-breaker uses viewerId so different users see different order even with same prefs
 * Pass viewerId (current user's profile id) so the feed order is never identical for everyone.
 */
export function sortDiscoveryProfiles(
  profiles: DiscoveryProfileFull[],
  filters: DiscoveryFilters,
  options?: { likedMeIds?: Set<string>; viewerId?: string }
): DiscoveryProfileFull[] {
  const likedMe = options?.likedMeIds ?? new Set<string>();
  const viewerId = options?.viewerId ?? "";
  return [...profiles].sort((a, b) => {
    const scoreA = effectiveDiscoveryScore(a, filters);
    const scoreB = effectiveDiscoveryScore(b, filters);
    if (scoreA !== scoreB) return scoreB - scoreA;
    const likedA = likedMe.has(a.id) ? 1 : 0;
    const likedB = likedMe.has(b.id) ? 1 : 0;
    if (likedA !== likedB) return likedB - likedA;
    return explorationSeed(b.id, viewerId) - explorationSeed(a.id, viewerId);
  });
}
