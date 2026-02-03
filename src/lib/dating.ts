/**
 * Dating discovery: full profiles, filters, like/pass, matching.
 * Non-anonymous; profiles are visible at all times.
 */

// =====================================================================// PROFILE (full, for discovery cards and profile view)
// =====================================================================
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
  sexualOrientation?: string;
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
  // This or That polls
  pollTniteOrStayIn?: string;
  poll145Surprises?: string;
  pollTeaPostOrNestle?: string;
  pollMaggiOrChai?: string;
  pollDormOrLibrary?: string;
  pollSectionOrBatch?: string;
  pollLKPOrHeritage?: string;
  pollMorningOrAfternoon?: string;
  pollCROrLKP?: string;
  // Non-negotiables (for filtering and display)
  nonNegotiables: string[];
}

// =====================================================================// FILTERS (intent-based, persisted)
// =====================================================================
export interface DiscoveryFilters {
  ageMin: number;
  ageMax: number;
  gendersInterestedIn: string[]; // e.g. ["Woman", "Man", "Non-Binary"]
  nonNegotiables: string[]; // e.g. ["Non-smoking", "Serious intent"]
}

export const DEFAULT_FILTERS: DiscoveryFilters = {
  ageMin: 21,
  ageMax: 45,
  gendersInterestedIn: ["Woman", "Man", "Non-Binary"],
  nonNegotiables: [],
};

export const FILTER_STORAGE_KEY = "prom-discovery-filters";

export const NON_NEGOTIABLE_OPTIONS = [
  "Non-smoking",
  "Smoking okay",
  "No alcohol",
  "Alcohol okay",
  "Serious intent",
  "Casual / open",
  "Veg only",
  "No dietary preference",
] as const;

export const GENDER_OPTIONS = ["Woman", "Man", "Non-Binary"] as const;

// =====================================================================// LIKE / PASS / MATCH (API contract)
// =====================================================================
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

// =====================================================================// PROFILE PHOTOS (place images in public/profile-photos/)
// =====================================================================
/** Base path for dummy profile photos. Add p1.jpg, p2.jpg, ... p5.jpg (or .png) there. */
export const PROFILE_PHOTOS_BASE = "/profile-photos";

/** Photo URL for a profile id (e.g. p1 → /profile-photos/p1.jpg). Tries .jpg first. */
export function getProfilePhotoUrl(profileId: string, ext = "jpg"): string {
  return `${PROFILE_PHOTOS_BASE}/${profileId}.${ext}`;
}

// =====================================================================// MOCK DATA (for UX; replace with API)
// =====================================================================
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
    nonNegotiables: ["Non-smoking", "Serious intent"],
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
    nonNegotiables: ["Non-smoking", "Alcohol okay", "Serious intent"],
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
    nonNegotiables: ["Non-smoking", "No alcohol", "Serious intent"],
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
    nonNegotiables: ["Non-smoking", "Serious intent"],
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
    nonNegotiables: ["Non-smoking", "Serious intent"],
  },
];

/** Apply filters to a list of profiles (deterministic). */
export function applyFilters(
  profiles: DiscoveryProfileFull[],
  filters: DiscoveryFilters
): DiscoveryProfileFull[] {
  return profiles.filter((p) => {
    if (p.age < filters.ageMin || p.age > filters.ageMax) return false;
    if (filters.gendersInterestedIn.length && !filters.gendersInterestedIn.includes(p.gender))
      return false;
    for (const nn of filters.nonNegotiables) {
      if (!p.nonNegotiables.includes(nn)) return false;
    }
    return true;
  });
}
