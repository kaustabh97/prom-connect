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
/** Default: 0.25 (25% preference, 75% global quality). Can be tuned based on user data. */
const DEFAULT_PREFERENCE_MATCH_WEIGHT = 0.25;

/** Minimum exploration probability for fair exposure (epsilon-greedy style). */
const EXPLORATION_EPSILON = 0.1; // 10% chance to explore lower-scored profiles

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
 * Returns 1.0 if no preferences are set (neutral, doesn't affect ranking).
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

  // If no preferences set, return neutral score (1.0) so it doesn't affect ranking
  if (factors === 0) return 1.0;
  
  // Normalize to [0, 1] range
  const normalized = score / factors;
  
  // Validate: ensure result is in valid range
  if (normalized < 0 || normalized > 1 || !isFinite(normalized)) {
    console.warn("[discoveryScore] Invalid preferenceMatchScore:", { score, factors, normalized });
    return 1.0; // Fallback to neutral
  }
  
  return normalized;
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
 * Profile exposure tracking for fair distribution (exploration/exploitation).
 */
export type ProfileExposure = {
  profileId: string;
  timesShown: number;
  lastShownAt?: number;
};

/**
 * Get exposure boost for a profile (0–0.05).
 * Profiles shown fewer times get a small boost to ensure fair visibility.
 * 
 * @param profileId - Profile ID to check
 * @param exposureMap - Map tracking exposure counts (optional)
 * @returns Boost value between 0 and 0.05
 */
function getExposureBoost(
  profileId: string,
  exposureMap?: Map<string, ProfileExposure>
): number {
  if (!exposureMap) return 0;
  const exposure = exposureMap.get(profileId);
  if (!exposure) return 0.05; // Small boost for never-seen profiles
  // Decrease boost as exposure increases (max 0.05, decreases by 0.01 per view)
  const boost = Math.max(0, 0.05 - exposure.timesShown * 0.01);
  return boost;
}

/**
 * Combined score (0–1) for the logged-in viewer: blends global discoveryScore with
 * how well the profile matches the viewer's preferences (cohort, intention).
 * Used so the feed is personalized at runtime for the current user.
 * 
 * @param preferenceWeight - Weight for preference match (0-1). Default: DEFAULT_PREFERENCE_MATCH_WEIGHT.
 *                            Lower values prioritize global quality, higher values prioritize preferences.
 */
export function effectiveDiscoveryScore(
  profile: DiscoveryProfileFull,
  filters: DiscoveryFilters,
  preferenceWeight: number = DEFAULT_PREFERENCE_MATCH_WEIGHT
): number {
  // Validate and clamp global score to [0, 1]
  const rawGlobal = profile.discoveryScore ?? 0;
  const global = Math.max(0, Math.min(1, rawGlobal));
  
  // Validate global score
  if (!isFinite(global)) {
    console.warn("[discoveryScore] Invalid global discoveryScore:", rawGlobal);
    return 0; // Fallback to minimum
  }
  
  // Get preference match score (already validated in preferenceMatchScore)
  const pref = preferenceMatchScore(profile, filters);
  
  // Clamp preference weight to valid range
  const weight = Math.max(0, Math.min(1, preferenceWeight));
  
  // Weighted blend: global * (1 - weight) + preference * weight
  const blended = global * (1 - weight) + pref * weight;
  
  // Final validation
  if (!isFinite(blended) || blended < 0 || blended > 1) {
    console.warn("[discoveryScore] Invalid effectiveDiscoveryScore:", { global, pref, weight, blended });
    return global; // Fallback to global score only
  }
  
  return blended;
}

/**
 * Sort discovery profiles for the logged-in viewer. Order is personalized per user:
 * - effectiveScore blends global discoveryScore with this viewer's preference match (cohort, intention)
 * - liked-me boost is per viewer
 * - exploration tie-breaker uses viewerId so different users see different order even with same prefs
 * - Optional exposure tracking for fair distribution
 * 
 * @param profiles - Profiles to sort
 * @param filters - Viewer's discovery filters
 * @param options - Sorting options
 * @param options.likedMeIds - Set of profile IDs that liked the viewer (for boost)
 * @param options.viewerId - Current viewer's profile ID (for personalization)
 * @param options.preferenceWeight - Weight for preference match (0-1). Default: DEFAULT_PREFERENCE_MATCH_WEIGHT
 * @param options.exposureMap - Map tracking profile exposure for fair distribution
 * @param options.enableExploration - Whether to apply exploration boost (epsilon-greedy). Default: true
 */
export function sortDiscoveryProfiles(
  profiles: DiscoveryProfileFull[],
  filters: DiscoveryFilters,
  options?: {
    likedMeIds?: Set<string>;
    viewerId?: string;
    preferenceWeight?: number;
    exposureMap?: Map<string, ProfileExposure>;
    enableExploration?: boolean;
  }
): DiscoveryProfileFull[] {
  const likedMe = options?.likedMeIds ?? new Set<string>();
  const viewerId = options?.viewerId ?? "";
  const preferenceWeight = options?.preferenceWeight ?? DEFAULT_PREFERENCE_MATCH_WEIGHT;
  const exposureMap = options?.exposureMap;
  const enableExploration = options?.enableExploration ?? true;
  
  // Create a copy to avoid mutating the original array
  const sorted = [...profiles].sort((a, b) => {
    // Calculate base effective scores
    const baseScoreA = effectiveDiscoveryScore(a, filters, preferenceWeight);
    const baseScoreB = effectiveDiscoveryScore(b, filters, preferenceWeight);
    
    // Apply liked-me boost (significant boost for reciprocity)
    const likedBoostA = likedMe.has(a.id) ? 0.15 : 0;
    const likedBoostB = likedMe.has(b.id) ? 0.15 : 0;
    
    // Apply exposure boost for fair distribution (if enabled)
    const exposureBoostA = enableExploration ? getExposureBoost(a.id, exposureMap) : 0;
    const exposureBoostB = enableExploration ? getExposureBoost(b.id, exposureMap) : 0;
    
    // Final scores with boosts
    const scoreA = Math.min(1, baseScoreA + likedBoostA + exposureBoostA);
    const scoreB = Math.min(1, baseScoreB + likedBoostB + exposureBoostB);
    
    // Primary sort: by effective score (with boosts)
    if (Math.abs(scoreA - scoreB) > 0.001) {
      return scoreB - scoreA;
    }
    
    // Secondary sort: liked-me (if scores are very close)
    const likedA = likedMe.has(a.id) ? 1 : 0;
    const likedB = likedMe.has(b.id) ? 1 : 0;
    if (likedA !== likedB) {
      return likedB - likedA;
    }
    
    // Tertiary sort: exploration seed (deterministic but per-user-per-day)
    const seedA = explorationSeed(a.id, viewerId);
    const seedB = explorationSeed(b.id, viewerId);
    return seedB - seedA;
  });
  
  return sorted;
}

/**
 * Apply tiered randomness to an already-sorted list of profiles.
 *
 * Idea:
 * - Keep overall ranking by score (best profiles are still near the top)
 * - Within position bands, shuffle to introduce randomness per reload
 * - Use larger bands deeper in the list so randomness increases as user goes further
 *
 * Current tiers (by index in the sorted list):
 * - [0, 10)   → shuffle within top 10
 * - [10, 25)  → shuffle within next 15
 * - [25, 50)  → shuffle within next 25
 * - [50, end) → fully shuffle the rest
 */
export function applyTieredRandomization(
  profiles: DiscoveryProfileFull[]
): DiscoveryProfileFull[] {
  const result = [...profiles];
  const n = result.length;
  if (n <= 1) return result;

  // Helper: in-place Fisher–Yates shuffle for a slice
  function shuffleSlice(start: number, end: number) {
    for (let i = end - 1; i > start; i--) {
      const j = start + Math.floor(Math.random() * (i - start + 1));
      const tmp = result[i];
      result[i] = result[j];
      result[j] = tmp;
    }
  }

  const tiers = [
    { start: 0, end: Math.min(10, n) },   // first 10
    { start: 10, end: Math.min(25, n) },  // next 15
    { start: 25, end: Math.min(50, n) },  // next 25
    { start: 50, end: n },                // rest
  ];

  for (const { start, end } of tiers) {
    if (end - start > 1 && start < n) {
      shuffleSlice(start, end);
    }
  }

  return result;
}
