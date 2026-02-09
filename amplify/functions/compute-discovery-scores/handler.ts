/**
 * Compute discovery scores for all discovery-eligible profiles.
 * Score = email-name match + age sanity + popularity + completeness + recency.
 * Age > MAX_REALISTIC_AGE → score forced to 0 (negative age band).
 * Run on schedule (EventBridge) or via custom query.
 */

import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { Client } from "aws-amplify/data";
import type { Schema } from "../../data/resource";
import { fetchAllUserProfiles } from "./utils";

const MAX_REALISTIC_AGE = 60;
const WEIGHT_EMAIL_NAME = 0.15;
const WEIGHT_AGE_SANITY = 0.05;
const WEIGHT_POPULARITY = 0.45;
const WEIGHT_COMPLETENESS = 0.30;
const WEIGHT_RECENCY = 0.05;
const RECENCY_DAYS_DECAY = 90;

/**
 * Calculate profile completeness factor (0–1) based on filled discovery-relevant fields.
 * 
 * Profiles with more complete information are more likely to be genuine and engaging,
 * so completeness is factored into the discovery score. This function checks if key
 * profile fields are filled (non-null, non-empty strings).
 * 
 * Fields checked:
 * - Basic info: bio, cohort, gender, intention, hometown
 * - Lifestyle preferences: alcoholPreference, smokingPreference, foodPreference,
 *   favouritePlace, teaOrCoffee, mountainOrBeach
 * - Poll responses: poll145Surprises, pollMaggiOrChai, pollSectionOrBatch,
 *   pollDormOrLibrary, pollNetflixOrGoingOut, pollTextingOrCalling,
 *   pollSurpriseOrPlanned, pollDeepOrSilly, pollBoredInRoom, pollCasualOrDressed
 * 
 * @param p - Profile object (UserProfile record) to check for completeness
 * @returns Completeness score between 0 and 1, where:
 *   - 0 = no fields filled
 *   - 1 = all fields filled
 *   - Values in between represent the fraction of fields that are filled
 * 
 * @example
 * // Profile with 10 out of 20 fields filled
 * completenessFactor(profile) // returns 0.5
 * 
 * // Profile with all fields filled
 * completenessFactor(completeProfile) // returns 1.0
 */
function completenessFactor(p: Record<string, unknown>): number {
  const fields = [
    "bio", "cohort", "gender", "intention", "hometown",
    "alcoholPreference", "smokingPreference", "foodPreference", "favouritePlace", "teaOrCoffee", "mountainOrBeach",
    "poll145Surprises", "pollMaggiOrChai", "pollSectionOrBatch", "pollDormOrLibrary", "pollNetflixOrGoingOut",
    "pollTextingOrCalling", "pollSurpriseOrPlanned", "pollDeepOrSilly", "pollBoredInRoom", "pollCasualOrDressed",
  ];
  let filled = 0;
  for (const key of fields) {
    const v = p[key];
    if (v != null && typeof v === "string" && v.trim() !== "") filled += 1;
  }
  return filled / fields.length;
}

/**
 * Calculate recency factor (0–1) based on when the profile was last updated.
 * 
 * Profiles that have been updated recently are more likely to be active and engaged,
 * so recency is factored into the discovery score. This encourages users to keep
 * their profiles up-to-date and helps surface active users in the discovery feed.
 * 
 * The function uses a linear decay model:
 * - Returns 1.0 if the profile was updated today or in the future (daysSince <= 0)
 * - Returns 0.0 if the profile hasn't been updated in RECENCY_DAYS_DECAY days or more
 * - Returns a value between 0 and 1 for profiles updated within the decay window,
 *   decreasing linearly as time passes
 * 
 * @param updatedAt - ISO timestamp string of when the profile was last updated, or null/undefined
 * @returns Recency factor between 0 and 1, where:
 *   - 1.0 = profile updated today or very recently (within decay window)
 *   - 0.0 = profile not updated or updated more than RECENCY_DAYS_DECAY days ago
 *   - Values in between represent linear decay based on days since last update
 * 
 * @example
 * // Profile updated today
 * recencyFactor("2026-02-09T10:00:00Z") // returns 1.0
 * 
 * // Profile updated 45 days ago (halfway through 90-day decay window)
 * recencyFactor("2025-12-26T10:00:00Z") // returns ~0.5
 * 
 * // Profile updated 90+ days ago
 * recencyFactor("2025-11-01T10:00:00Z") // returns 0.0
 * 
 * // Profile never updated
 * recencyFactor(null) // returns 0.0
 */
function recencyFactor(updatedAt: string | null | undefined): number {
  if (!updatedAt) return 0;
  const updated = new Date(updatedAt).getTime();
  const now = Date.now();
  const daysSince = (now - updated) / (24 * 60 * 60 * 1000);
  if (daysSince <= 0) return 1;
  if (daysSince >= RECENCY_DAYS_DECAY) return 0;
  return 1 - daysSince / RECENCY_DAYS_DECAY;
}

/**
 * Extract the name part from an IIMA email address.
 * Handles patterns like:
 * - p24akash@iima.ac.in → "akash"
 * - p24akshatkumar@iima.ac.in → "akshatkumar"
 * - afp25john@iima.ac.in → "john"
 * 
 * Logic: If email contains numbers, extract everything after the last number.
 * Otherwise, extract the name part directly.
 * 
 * @param email - Email address to parse
 * @returns The name part extracted from the email, or null if invalid
 */
function parseIIMAEmailName(email: string): string | null {
  if (!email || typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.endsWith("@iima.ac.in")) return null;
  
  // Remove @iima.ac.in suffix
  const localPart = trimmed.replace("@iima.ac.in", "");
  
  // If email contains numbers, extract everything after the last number
  // Find the index of the last digit in the string
  let lastNumberIndex = -1;
  for (let i = localPart.length - 1; i >= 0; i--) {
    if (/\d/.test(localPart[i])) {
      lastNumberIndex = i;
      break;
    }
  }
  
  if (lastNumberIndex !== -1) {
    const namePart = localPart.substring(lastNumberIndex + 1);
    return namePart.length > 0 ? namePart : null;
  }
  
  // No numbers found, return the entire local part as name
  return localPart.length > 0 ? localPart : null;
}

/**
 * Extract the first name from a display name.
 * 
 * @param displayName - Full display name (e.g., "Akshat Kumar")
 * @returns The first name in lowercase, or empty string if invalid
 */
function firstName(displayName: string): string {
  const n = (displayName || "").trim().toLowerCase().replace(/\s+/g, " ").split(/\s+/)[0];
  return n || "";
}

/**
 * Extract all name parts (first + last) from a display name, concatenated.
 * 
 * @param displayName - Full display name (e.g., "Akshat Kumar")
 * @returns Concatenated name parts in lowercase (e.g., "akshatkumar"), or empty string if invalid
 */
function fullNameConcatenated(displayName: string): string {
  const parts = (displayName || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 0);
  return parts.join("");
}

/**
 * Check if the email name matches the display name.
 * Handles various cases:
 * - Exact match: "akash" === "akash"
 * - First name match: "akash" matches "Akash Kumar"
 * - Concatenated name match: "akshatkumar" matches "Akshat Kumar"
 * - Partial match: First 5-10 characters match (for edge cases)
 * 
 * @param email - Email address (e.g., "p24akshatkumar@iima.ac.in")
 * @param displayName - Display name (e.g., "Akshat Kumar")
 * @returns true if email name matches display name, false otherwise
 */
function emailNameMatchesDisplayName(email: string, displayName: string): boolean {
  const emailName = parseIIMAEmailName(email);
  if (!emailName || !displayName?.trim()) return false;

  const displayFirst = firstName(displayName);
  const displayFull = fullNameConcatenated(displayName);

  if (!displayFirst && !displayFull) return false;

  // Exact match with first name
  if (emailName === displayFirst) return true;

  // Exact match with concatenated full name
  if (displayFull && emailName === displayFull) return true;

  // Email starts with first name (with small suffix tolerance)
  if (emailName.startsWith(displayFirst) && emailName.length <= displayFirst.length + 2) {
    return true;
  }

  // First name starts with email name (with small prefix tolerance)
  if (displayFirst.startsWith(emailName) && displayFirst.length <= emailName.length + 2) {
    return true;
  }

  // Email contains concatenated full name (handles "akshatkumar" matching "Akshat Kumar")
  if (displayFull && emailName.includes(displayFull)) {
    return true;
  }

  // Concatenated full name contains email name (handles partial matches)
  if (displayFull && displayFull.includes(emailName)) {
    return true;
  }

  // Partial match: Check if first 5-10 characters match
  // This handles edge cases where names might have slight variations
  const minMatchLength = Math.min(5, emailName.length, displayFirst.length);
  const maxMatchLength = Math.min(10, emailName.length, displayFirst.length);
  
  for (let len = maxMatchLength; len >= minMatchLength; len--) {
    const emailPrefix = emailName.substring(0, len);
    const namePrefix = displayFirst.substring(0, len);
    if (emailPrefix === namePrefix) {
      return true;
    }
  }

  // Also check against concatenated full name
  if (displayFull) {
    for (let len = maxMatchLength; len >= minMatchLength; len--) {
      const emailPrefix = emailName.substring(0, len);
      const fullPrefix = displayFull.substring(0, len);
      if (emailPrefix === fullPrefix) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a profile is eligible for discovery scoring.
 * A profile is eligible if:
 * - Has an ID
 * - Has completed onboarding
 * - Is not explicitly excluded from discovery
 * - Is not in the partner flow (bio doesn't start with "Partner:")
 * 
 * @param profile - UserProfile to check
 * @returns true if profile is eligible for discovery scoring, false otherwise
 */
function isProfileDiscoveryEligible(profile: Schema["UserProfile"]["type"]): boolean {
  return !!(
    profile.id &&
    profile.onboardingCompleted === true &&
    profile.excludeFromDiscovery !== true &&
    !(typeof profile.bio === "string" && profile.bio.trim().startsWith("Partner:"))
  );
}

/**
 * Clear discovery scores for profiles that are no longer eligible for discovery.
 * This ensures that profiles that become ineligible (e.g., complete partner flow,
 * exclude themselves, or incomplete onboarding) don't retain stale scores.
 * 
 * @param client - Amplify Data client instance
 * @param profiles - Array of all UserProfile records to check
 * @returns Promise resolving to the number of profiles that had their scores cleared
 */
async function clearDiscoveryScoresForIneligibleProfiles(
  client: Client<Schema>,
  profiles: Schema["UserProfile"]["type"][]
): Promise<number> {
  const now = new Date().toISOString();
  let cleared = 0;

  for (const profile of profiles) {
    const isEligible = isProfileDiscoveryEligible(profile);

    // If profile has a score but is no longer eligible, clear it
    if (!isEligible && profile.discoveryScore != null) {
      await client.models.UserProfile.update({
        id: profile.id!,
        email: profile.email ?? undefined,
        discoveryScore: null,
        lastDiscoveryScoreAt: now,
      } as Parameters<typeof client.models.UserProfile.update>[0]);
      cleared += 1;
    }
  }

  return cleared;
}

/**
 * Normalize popularity scores using base-10 logarithmic scaling to reduce rich-get-richer effects.
 * 
 * Uses log normalization: log10(1 + likes) / log10(1 + maxLikes)
 * 
 * This approach compresses the heavy tail distribution, making the scoring system more fair:
 * - Profiles with 0 likes → ~0.0 (log10(1) / log10(1+max) = 0)
 * - Profiles with maxLikes → 1.0 (log10(1+max) / log10(1+max) = 1)
 * - Mid-range profiles get boosted relative to linear scaling
 * - Top profiles get compressed (reducing the advantage gap)
 * 
 * Example with maxLikes = 100:
 * - 10 likes: linear = 0.10, log = ~0.48 (boosted)
 * - 50 likes: linear = 0.50, log = ~0.85 (boosted)
 * - 100 likes: linear = 1.00, log = 1.00 (same)
 * 
 * Benefits:
 * - Compresses heavy tails in the distribution
 * - Reduces the advantage gap between highly popular and moderately popular profiles
 * - More robust to outliers
 * - Ensures fairer distribution of popularity scores
 * 
 * @param likes - Number of likes received by a user
 * @param maxLikes - Maximum number of likes received by any user (for normalization)
 * @returns Normalized popularity score between 0 and 1
 * 
 * @example
 * // With maxLikes = 100
 * normalizePopularityLog(0, 100)   // returns log10(1) / log10(101) = 0.0
 * normalizePopularityLog(10, 100) // returns log10(11) / log10(101) ≈ 0.48 (vs 0.10 linear)
 * normalizePopularityLog(50, 100) // returns log10(51) / log10(101) ≈ 0.85 (vs 0.50 linear)
 * normalizePopularityLog(100, 100) // returns log10(101) / log10(101) = 1.0
 */
function normalizePopularityLog(likes: number, maxLikes: number): number {
  // Ensure non-negative values
  const safeLikes = Math.max(0, likes);
  const safeMaxLikes = Math.max(1, maxLikes); // At least 1 to avoid division by zero
  
  // Base-10 log normalization: log10(1 + likes) / log10(1 + maxLikes)
  // Adding 1 ensures log10(1) = 0 for zero likes, and avoids log10(0) = -Infinity
  const numerator = Math.log10(1 + safeLikes);
  const denominator = Math.log10(1 + safeMaxLikes);
  
  // Safety check: if denominator is 0 (shouldn't happen with safeMaxLikes >= 1), return 0
  if (denominator <= 0 || !isFinite(denominator)) {
    console.warn("[normalizePopularityLog] Invalid denominator:", { likes, maxLikes, denominator });
    return 0;
  }
  
  const normalized = numerator / denominator;
  
  // Clamp to [0, 1] range (should already be in range, but safety check)
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Count the number of likes received by each user (popularity metric).
 * Fetches all Like records with pagination and aggregates counts by toUserId.
 * This is used to calculate the popularity component of the discovery score.
 * 
 * @param client - Amplify Data client instance
 * @returns Promise resolving to a map of userId -> number of likes received
 */
async function countLikesByRecipient(
  client: Client<Schema>
): Promise<Record<string, number>> {
  const likeCountByToUserId: Record<string, number> = {};
  let likeNextToken: string | undefined;

  do {
    const likeRes = await (client.models.Like as {
      list: (opts: unknown) => Promise<{ data?: { toUserId?: string }[]; nextToken?: string }>;
    }).list({ nextToken: likeNextToken });

    const page = likeRes.data ?? [];
    for (const like of page) {
      const to = like.toUserId;
      if (to) {
        likeCountByToUserId[to] = (likeCountByToUserId[to] ?? 0) + 1;
      }
    }

    likeNextToken = likeRes.nextToken ?? undefined;
  } while (likeNextToken);

  return likeCountByToUserId;
}

export const handler = async (): Promise<{ updated: number; cleared?: number; error?: string }> => {
  const startTime = new Date().toISOString();
  console.log("[compute-discovery-scores] Starting cron job at", startTime);
  
  try {
    // Dynamic import for Amplify env (special pattern that must be dynamic)
    const env = (await import("$amplify/env/compute-discovery-scores")).env;
    const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
    Amplify.configure(resourceConfig, libraryOptions);
    const client = generateClient<Schema>();

    const allProfiles = await fetchAllUserProfiles(client);

    // Clear discovery scores for profiles that are no longer eligible
    const cleared = await clearDiscoveryScoresForIneligibleProfiles(client, allProfiles);

    // Filter to only discovery-eligible profiles for score computation
    const allDiscoveryEligibleProfiles = allProfiles.filter(isProfileDiscoveryEligible);

    // Count likes received by each user (for popularity score component)
    const likeCountByToUserId = await countLikesByRecipient(client);
    const maxLikes = Math.max(1, ...Object.values(likeCountByToUserId));
    
    // Calculate popularity statistics for logging
    const likeValues = Object.values(likeCountByToUserId);
    const totalLikes = likeValues.reduce((sum, count) => sum + count, 0);
    const avgLikes = likeValues.length > 0 ? totalLikes / likeValues.length : 0;
    const sortedLikes = [...likeValues].sort((a, b) => a - b);
    const medianLikes = sortedLikes.length > 0 
      ? sortedLikes[Math.floor(sortedLikes.length / 2)]
      : 0;
    
    // Calculate percentiles for distribution analysis
    const percentile = (arr: number[], p: number): number => {
      if (arr.length === 0) return 0;
      const index = Math.floor((p / 100) * arr.length);
      return arr[Math.min(index, arr.length - 1)];
    };
    
    const p25 = percentile(sortedLikes, 25);
    const p75 = percentile(sortedLikes, 75);
    const p90 = percentile(sortedLikes, 90);
    const p95 = percentile(sortedLikes, 95);
    const p99 = percentile(sortedLikes, 99);
    
    // Sample normalization examples for different like counts
    const sampleLikeCounts = [0, 1, 5, 10, 25, 50, 75, maxLikes].filter(l => l <= maxLikes);
    const normalizationExamples = sampleLikeCounts.map(likes => {
      const linearNorm = maxLikes > 0 ? likes / maxLikes : 0;
      const logNorm = normalizePopularityLog(likes, maxLikes);
      const boost = linearNorm > 0 ? ((logNorm - linearNorm) / linearNorm) * 100 : 0;
      return {
        likes,
        linearNorm: Math.round(linearNorm * 1000) / 1000,
        logNorm: Math.round(logNorm * 1000) / 1000,
        boostPercent: Math.round(boost * 10) / 10,
      };
    });
    
    console.log("[compute-discovery-scores] Popularity distribution statistics:", {
      totalProfiles: likeValues.length,
      maxLikes,
      totalLikes,
      avgLikes: Math.round(avgLikes * 100) / 100,
      medianLikes,
      profilesWithZeroLikes: likeValues.filter(v => v === 0).length,
      profilesWithLikes: likeValues.filter(v => v > 0).length,
      percentiles: {
        p25,
        p50: medianLikes,
        p75,
        p90,
        p95,
        p99,
      },
    });
    
    console.log("[compute-discovery-scores] Log normalization examples (base-10 log):", {
      maxLikes,
      examples: normalizationExamples,
      note: "Log normalization boosts mid-range profiles and compresses the top end",
    });

    const now = new Date().toISOString();
    let updated = 0;
    let popularityStats = {
      linearSum: 0,
      logSum: 0,
      maxLinearNorm: 0,
      maxLogNorm: 0,
      profilesProcessed: 0,
    };
    
    for (const profile of allDiscoveryEligibleProfiles) {
      const id = profile.id!;

      // Check if email address is similar to name. Could be a fake profile otherwise. Small weight to this though.
      // THIS IS TRUE/FALSE SCORE.
      const emailMatch = emailNameMatchesDisplayName(profile.email ?? "", profile.name ?? "") ? 1 : 0;
      
      // Check if age is realistic to avoid fake profiles. Small weight to this though.
      // THIS IS TRUE/FALSE SCORE.
      // Negative age band (8): if age > 60, force score to 0
      const age = profile.age ?? null;
      const ageSanity = age != null && age <= MAX_REALISTIC_AGE ? 1 : 0;
      if (age != null && age > MAX_REALISTIC_AGE) {
        await client.models.UserProfile.update({
          id,
          email: profile.email ?? undefined,
          discoveryScore: 0,
          lastDiscoveryScoreAt: now,
        } as Parameters<typeof client.models.UserProfile.update>[0]);
        updated += 1;
        continue;
      }

      // Check if profile is complete. Small weight to this though.
      // This is a 0-1 scale score.
      const completeness = completenessFactor(profile as Record<string, unknown>);

      // Check if profile is recent. Small weight to this though.
      // This is a 0-1 scale score.
      const recency = recencyFactor(profile.updatedAt ?? undefined);

      // Calculate popularity using log normalization to reduce rich-get-richer effect
      const likes = likeCountByToUserId[id] ?? 0;
      const popularityNorm = normalizePopularityLog(likes, maxLikes);
      
      // Track statistics for logging (compare linear vs log normalization)
      const linearNorm = likes / maxLikes;
      popularityStats.linearSum += linearNorm;
      popularityStats.logSum += popularityNorm;
      popularityStats.maxLinearNorm = Math.max(popularityStats.maxLinearNorm, linearNorm);
      popularityStats.maxLogNorm = Math.max(popularityStats.maxLogNorm, popularityNorm);
      popularityStats.profilesProcessed += 1;
      const score =
        WEIGHT_EMAIL_NAME * emailMatch +
        WEIGHT_AGE_SANITY * ageSanity +
        WEIGHT_POPULARITY * popularityNorm +
        WEIGHT_COMPLETENESS * completeness +
        WEIGHT_RECENCY * recency;

      await client.models.UserProfile.update({
        id,
        email: profile.email ?? undefined,
        discoveryScore: Math.round(score * 100) / 100,
        lastDiscoveryScoreAt: now,
      } as Parameters<typeof client.models.UserProfile.update>[0]);
      updated += 1;
    }

    // Log popularity normalization comparison statistics
    if (popularityStats.profilesProcessed > 0) {
      const avgLinearNorm = popularityStats.linearSum / popularityStats.profilesProcessed;
      const avgLogNorm = popularityStats.logSum / popularityStats.profilesProcessed;
      const compressionRatio = popularityStats.maxLinearNorm > 0 
        ? popularityStats.maxLogNorm / popularityStats.maxLinearNorm 
        : 1;
      const avgBoost = avgLinearNorm > 0 
        ? ((avgLogNorm - avgLinearNorm) / avgLinearNorm) * 100 
        : 0;
      
      // Calculate distribution of normalized scores
      const linearNormValues: number[] = [];
      const logNormValues: number[] = [];
      for (const profile of allDiscoveryEligibleProfiles) {
        const id = profile.id!;
        const likes = likeCountByToUserId[id] ?? 0;
        if (likes >= 0) {
          linearNormValues.push(likes / maxLikes);
          logNormValues.push(normalizePopularityLog(likes, maxLikes));
        }
      }
      
      const linearNormSorted = [...linearNormValues].sort((a, b) => a - b);
      const logNormSorted = [...logNormValues].sort((a, b) => a - b);
      
      // Helper function for percentiles (redefined here for scope)
      const percentile = (arr: number[], p: number): number => {
        if (arr.length === 0) return 0;
        const index = Math.floor((p / 100) * arr.length);
        return arr[Math.min(index, arr.length - 1)];
      };
      
      console.log("[compute-discovery-scores] Popularity normalization comparison (base-10 log):", {
        profilesProcessed: popularityStats.profilesProcessed,
        maxLikes,
        averages: {
          linearNorm: Math.round(avgLinearNorm * 1000) / 1000,
          logNorm: Math.round(avgLogNorm * 1000) / 1000,
          avgBoostPercent: Math.round(avgBoost * 10) / 10,
        },
        maxValues: {
          linearNorm: Math.round(popularityStats.maxLinearNorm * 1000) / 1000,
          logNorm: Math.round(popularityStats.maxLogNorm * 1000) / 1000,
          compressionRatio: Math.round(compressionRatio * 1000) / 1000,
        },
        distribution: {
          linearNorm: {
            p25: Math.round(percentile(linearNormSorted, 25) * 1000) / 1000,
            p50: Math.round(percentile(linearNormSorted, 50) * 1000) / 1000,
            p75: Math.round(percentile(linearNormSorted, 75) * 1000) / 1000,
            p90: Math.round(percentile(linearNormSorted, 90) * 1000) / 1000,
            p95: Math.round(percentile(linearNormSorted, 95) * 1000) / 1000,
          },
          logNorm: {
            p25: Math.round(percentile(logNormSorted, 25) * 1000) / 1000,
            p50: Math.round(percentile(logNormSorted, 50) * 1000) / 1000,
            p75: Math.round(percentile(logNormSorted, 75) * 1000) / 1000,
            p90: Math.round(percentile(logNormSorted, 90) * 1000) / 1000,
            p95: Math.round(percentile(logNormSorted, 95) * 1000) / 1000,
          },
        },
        note: "Log normalization boosts mid-range profiles (increases their scores) and compresses the top end (reduces advantage gap)",
      });
    }

    const endTime = new Date().toISOString();
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    console.log("[compute-discovery-scores] Completed successfully:", {
      updated,
      cleared,
      totalProfiles: allProfiles.length,
      eligibleProfiles: allDiscoveryEligibleProfiles.length,
      startTime,
      endTime,
      durationMs,
    });
    return { updated, cleared };
  } catch (err) {
    const endTime = new Date().toISOString();
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    console.error("[compute-discovery-scores] Failed:", {
      error: err,
      startTime,
      endTime,
      durationMs,
    });
    const message = err instanceof Error ? err.message : String(err);
    return { updated: 0, error: message };
  }
};
