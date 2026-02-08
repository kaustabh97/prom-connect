/**
 * Dating discovery: full profiles, filters, like/pass, matching.
 * Non-anonymous; profiles are visible at all times.
 */

// ============================================================================
// PROFILE (full, for discovery cards and profile view)
// ============================================================================

export interface DiscoveryProfileFull {
  id: string;
  name: string;
  age: number;
  gender: string;
  bio: string;
  tags: string[];
  photoUrls: string[]; // main first; empty = placeholder
  // From onboarding
  cohort?: string;
  intention?: string;
  hometown?: string;
  sexualOrientation?: string;
  // Campus / lifestyle (for full profile)
  alcoholPreference?: string;
  smokingPreference?: string;
  foodPreference?: string;
  favouritePlace?: string;
  teaOrCoffee?: string;
  mountainOrBeach?: string;
  // Fun answers (optional, added after onboarding)
  morningOrNightPerson?: string;
  idealWeekend?: string;
  goToKaraokeSong?: string;
  superpowerChoice?: string;
  favouriteMovieGenre?: string;
  secretTalent?: string;
  favouriteChaiSpot?: string;
  idealPromOutfit?: string;
  messOrOutside?: string;
  bestDateSpotOnCampus?: string;
  bollywoodOrEnglishAtProm?: string;
  lateNightRitual?: string;
  perfectSaturdayAtIIMA?: string;
  goToBollywoodSong?: string;
  // This or That polls (5 IIMA + 5 general)
  poll145Surprises?: string;
  pollMaggiOrChai?: string;
  pollSectionOrBatch?: string;
  pollDormOrLibrary?: string;
  pollNetflixOrGoingOut?: string;
  pollTextingOrCalling?: string;
  pollSurpriseOrPlanned?: string;
  pollDeepOrSilly?: string;
  pollBoredInRoom?: string;
  pollCasualOrDressed?: string;
}

// ============================================================================
// FILTERS (intent-based, persisted)
// ============================================================================

export interface DiscoveryFilters {
  ageMin: number;
  ageMax: number;
  gendersInterestedIn: string[]; // e.g. ["Woman", "Man", "Non-Binary"]
  /** Preferred cohorts (multi-select). Display-only preference; does not filter profiles. */
  preferredCohorts: string[];
  /** Preferred intention (single-select). Display-only preference; does not filter profiles. */
  preferredIntention: string | null;
}

export const DEFAULT_FILTERS: DiscoveryFilters = {
  ageMin: 21,
  ageMax: 45,
  gendersInterestedIn: ["Woman", "Man", "Non-Binary"],
  preferredCohorts: [],
  preferredIntention: null,
};

export const FILTER_STORAGE_KEY = "prom-discovery-filters";

/** Cohort options for Preferences (multi-select). Matches onboarding. */
export const PREFERRED_COHORT_OPTIONS = ["PGP1", "PGP2", "PGPX", "PhD", "AA", "Staff", "Other"] as const;

/**
 * Returns the display label for a cohort value (backend stays PGP1/PGP2).
 * PGP1 → "PGP/FABM 1", PGP2 → "PGP/FABM 2" for inclusivity of FABM programme.
 */
export function getCohortDisplayLabel(cohort: string | undefined | null): string {
  if (!cohort) return "";
  if (cohort === "PGP1") return "PGP/FABM 1";
  if (cohort === "PGP2") return "PGP/FABM 2";
  return cohort;
}

/** Intention options for Preferences (single-select). Matches onboarding. */
export const PREFERRED_INTENTION_OPTIONS = [
  "Just here for prom night",
  "Taken, but need a prom buddy",
  "Looking for something real",
  "Let's see where this goes",
] as const;

export const GENDER_OPTIONS = ["Woman", "Man", "Non-Binary"] as const;

/**
 * Map user's sexual orientation and gender to gender preferences for filters.
 * Straight Man → Women; Straight Woman → Men; Gay/Lesbian → same gender; etc.
 */
export function mapSexualOrientationToGenders(
  sexualOrientation: string | null | undefined,
  userGender: string | null | undefined
): string[] {
  if (!sexualOrientation || !userGender) {
    return [...GENDER_OPTIONS]; // Default: all genders
  }

  const orientation = sexualOrientation.toLowerCase().trim();
  const gender = userGender.toLowerCase().trim();

  // Straight: interested in opposite gender
  if (orientation === "straight") {
    if (gender === "man") return ["Woman"];
    if (gender === "woman") return ["Man"];
    return [...GENDER_OPTIONS];
  }

  // Gay or Lesbian: interested in same gender (Lesbian = woman interested in women)
  if (["gay", "lesbian"].includes(orientation)) {
    if (gender === "man") return ["Man"];
    if (gender === "woman") return ["Woman"];
    return [...GENDER_OPTIONS];
  }

  // Bisexual, Queer, Pansexual, Other: interested in all genders
  if (["bisexual", "queer", "pansexual", "other"].includes(orientation)) {
    return [...GENDER_OPTIONS];
  }

  return [...GENDER_OPTIONS];
}

// ============================================================================
// LIKE / PASS / MATCH (API contract)
// ============================================================================

export type SwipeAction = "like" | "pass";

export interface LikePayload {
  fromUserId: string;
  toUserId: string;
}

export interface MatchRecord {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: string;
}

// ============================================================================
// PROFILE PHOTOS (place images in public/profile-photos/)
// ============================================================================

/** Base path for dummy profile photos. Add p1.jpg, p2.jpg, ... p5.jpg (or .png) there. */
export const PROFILE_PHOTOS_BASE = "/profile-photos";

/** Photo URL for a profile id (e.g. p1 → /profile-photos/p1.jpg). Tries .jpg first. */
export function getProfilePhotoUrl(profileId: string, ext = "jpg"): string {
  return `${PROFILE_PHOTOS_BASE}/${profileId}.${ext}`;
}

// ============================================================================
// MOCK DATA (for UX; replace with API)
// ============================================================================

export const MOCK_DISCOVERY_PROFILES_FULL: DiscoveryProfileFull[] = [
  {
    id: "p1",
    name: "Priya",
    age: 24,
    gender: "Woman",
    bio: "Tea Post regular. Love deep conversations and early morning runs.",
    tags: ["Running", "Music", "Debate", "Coffee"],
    photoUrls: [getProfilePhotoUrl("p1")],
    alcoholPreference: "Sometimes",
    smokingPreference: "Never",
    foodPreference: "Veg",
    favouritePlace: "Library",
    teaOrCoffee: "Tea",
    mountainOrBeach: "Mountain",
    sexualOrientation: "Straight",
  },
  {
    id: "p2",
    name: "Arjun",
    age: 23,
    gender: "Man",
    bio: "Night owl who loves late-night conversations at Tea Post. Bollywood enthusiast—can quote dialogues from any SRK movie. Passionate about dance (Bhangra is my jam!) and exploring new cuisines. Looking for someone who appreciates good food, meaningful conversations, and spontaneous adventures. Here for genuine connections that go beyond small talk.",
    tags: ["Movies", "Dance", "Travel", "Food", "Bollywood", "Photography", "Gaming", "Fitness"],
    photoUrls: [getProfilePhotoUrl("p2")],
    alcoholPreference: "Sometimes",
    smokingPreference: "Never",
    foodPreference: "Non-Veg",
    favouritePlace: "Tea Post",
    teaOrCoffee: "Coffee",
    mountainOrBeach: "Beach",
    sexualOrientation: "Straight",
  },
  {
    id: "p3",
    name: "Riya",
    age: 22,
    gender: "Woman",
    bio: "Library vibes > chaos. Love poetry and chai.",
    tags: ["Reading", "Poetry", "Art", "Tea"],
    photoUrls: [getProfilePhotoUrl("p3")],
    alcoholPreference: "Never",
    smokingPreference: "Never",
    foodPreference: "Veg",
    favouritePlace: "LKP",
    teaOrCoffee: "Tea",
    mountainOrBeach: "Mountain",
    sexualOrientation: "Straight",
  },
  {
    id: "p4",
    name: "Vikram",
    age: 25,
    gender: "Man",
    bio: "Early bird. Career-driven but love weekend getaways.",
    tags: ["Running", "Tech", "Finance", "Travel"],
    photoUrls: [getProfilePhotoUrl("p4")],
    alcoholPreference: "Sometimes",
    smokingPreference: "Never",
    foodPreference: "Eggetarian",
    favouritePlace: "Sports Complex",
    teaOrCoffee: "Coffee",
    mountainOrBeach: "Both",
    sexualOrientation: "Straight",
  },
  {
    id: "p5",
    name: "Ananya",
    age: 23,
    gender: "Woman",
    bio: "Foodie. Small groups over parties. Looking for something real.",
    tags: ["Food", "Cooking", "Photography", "Coffee"],
    photoUrls: [getProfilePhotoUrl("p5")],
    alcoholPreference: "Sometimes",
    smokingPreference: "Never",
    foodPreference: "Veg",
    favouritePlace: "CR",
    teaOrCoffee: "Both",
    mountainOrBeach: "Beach",
    sexualOrientation: "Straight",
  },
];

/** Normalize gender for comparison (filter options use "Woman" / "Man" / "Non-Binary"). */
function normalizeGender(g: string): string {
  const lower = (g || "").trim().toLowerCase();
  if (lower === "woman" || lower === "man") return lower.charAt(0).toUpperCase() + lower.slice(1);
  if (lower === "non-binary" || lower === "nonbinary") return "Non-Binary";
  return g;
}

/**
 * Apply filters to a list of profiles.
 * Only the "Interested in" (gender) filter is applied.
 * Age range and Preferences (cohort, intention) do not filter results.
 */
export function applyFilters(
  profiles: DiscoveryProfileFull[],
  filters: DiscoveryFilters
): DiscoveryProfileFull[] {
  return profiles.filter((p) => {
    // Only filter by gender (who the user is interested in)
    if (filters.gendersInterestedIn.length > 0) {
      const profileGender = normalizeGender(p.gender);
      const matchesGender = filters.gendersInterestedIn.some(
        (g) => normalizeGender(g) === profileGender
      );
      if (!matchesGender) return false;
    }
    // Age and Preferences (cohort, intention) are not applied
    return true;
  });
}
