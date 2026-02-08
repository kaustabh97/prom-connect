/**
 * Discovery feed scoring and ordering.
 * - Backend (Lambda) computes: email-name match, age sanity, popularity → discoveryScore on UserProfile.
 * - Client computes: preference match (cohort, intention) and sorts by discoveryScore then preference.
 */

import type { DiscoveryProfileFull, DiscoveryFilters } from "./dating";

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

/** Stable small "explore" value 0–1 per profile for the day (diversity/exploration). */
function explorationSeed(profileId: string): number {
  const today = new Date().toISOString().slice(0, 10);
  let h = 0;
  const s = today + profileId;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

/**
 * Sort discovery profiles: discoveryScore (desc), then liked-me boost (9), then preference match (desc), then exploration (11).
 */
export function sortDiscoveryProfiles(
  profiles: DiscoveryProfileFull[],
  filters: DiscoveryFilters,
  options?: { likedMeIds?: Set<string> }
): DiscoveryProfileFull[] {
  const likedMe = options?.likedMeIds ?? new Set<string>();
  return [...profiles].sort((a, b) => {
    const scoreA = a.discoveryScore ?? -1;
    const scoreB = b.discoveryScore ?? -1;
    if (scoreA !== scoreB) return scoreB - scoreA;
    const likedA = likedMe.has(a.id) ? 1 : 0;
    const likedB = likedMe.has(b.id) ? 1 : 0;
    if (likedA !== likedB) return likedB - likedA;
    const prefA = preferenceMatchScore(a, filters);
    const prefB = preferenceMatchScore(b, filters);
    if (prefA !== prefB) return prefB - prefA;
    return explorationSeed(b.id) - explorationSeed(a.id);
  });
}
