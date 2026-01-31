/**
 * Discovery Module
 * ----------------
 * Types, constants, and API contracts for the preference discovery flow.
 * This module is designed to support later matchmaking algorithm evolution.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface TraitQuestion {
  traitId: string;   // Trait identifier for backend
  question: string;  // Short question shown to user
  answer: string;    // 1-2 word answer
}

export interface DiscoveryProfile {
  id: string;
  age: number;
  program?: string; // e.g., "PGP 2024-26"
  traitQuestions: TraitQuestion[]; // 8 items, displayed in 4x2 grid
}

export interface TraitSelection {
  viewerUserId: string;
  profileUserId: string;
  selectedTraitIds: string[];   // The 2 trait IDs user selected
  allTraitIds: string[];        // All 8 trait IDs shown on profile
  createdAt: string;
}

export interface DiscoverySession {
  userId: string;
  profiles: DiscoveryProfile[];
  selections: TraitSelection[];
  startedAt: string;
  completedAt?: string;
}

// ============================================================================
// PREDEFINED TRAITS (Platform-controlled)
// ============================================================================

export const PLATFORM_TRAITS = [
  { id: "fitness", label: "Fitness-oriented" },
  { id: "ambitious", label: "Ambitious" },
  { id: "chill", label: "Chill personality" },
  { id: "academic", label: "Academically focused" },
  { id: "social", label: "Social / outgoing" },
  { id: "introverted", label: "Introverted" },
  { id: "creative", label: "Creative" },
  { id: "spiritual", label: "Spiritual" },
  { id: "career", label: "Career-driven" },
  { id: "explorer", label: "Explorer / travel-loving" },
  { id: "foodie", label: "Foodie" },
  { id: "intellectual", label: "Intellectual" },
  { id: "humorous", label: "Good sense of humour" },
  { id: "empathetic", label: "Empathetic" },
  { id: "independent", label: "Independent" },
] as const;

export type TraitId = (typeof PLATFORM_TRAITS)[number]["id"];

export function getTraitLabel(id: string): string {
  return PLATFORM_TRAITS.find((t) => t.id === id)?.label ?? id;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DISCOVERY_CONFIG = {
  /** Number of profiles to show in one discovery session */
  PROFILES_COUNT: 8,
  /** Traits per profile (4 rows × 2 columns) */
  TRAITS_PER_PROFILE: 8,
  /** Exact number of traits user must select per profile */
  REQUIRED_SELECTIONS: 2,
} as const;

// ============================================================================
// API CONTRACTS (for backend integration)
// ============================================================================

/**
 * GET /api/discovery/profiles
 * Fetches randomised discovery profiles for the current user.
 * Backend applies hard filters (sexuality, age range) and shuffles.
 */
export interface FetchDiscoveryProfilesRequest {
  userId: string;
}

export interface FetchDiscoveryProfilesResponse {
  profiles: DiscoveryProfile[];
  sessionId: string;
}

/**
 * POST /api/discovery/selection
 * Submits trait selection for one profile.
 */
export interface SubmitTraitSelectionRequest {
  sessionId: string;
  viewerUserId: string;
  profileUserId: string;
  selectedTraitIds: string[];
  allTraitIds: string[];
}

export interface SubmitTraitSelectionResponse {
  success: boolean;
  selectionsCount: number; // How many selections user has made so far
}

/**
 * POST /api/discovery/complete
 * Marks discovery session as complete.
 */
export interface CompleteDiscoveryRequest {
  sessionId: string;
  userId: string;
}

export interface CompleteDiscoveryResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// MOCK DATA (for development)
// ============================================================================

export const MOCK_DISCOVERY_PROFILES: DiscoveryProfile[] = [
  {
    id: "profile-1",
    age: 23,
    program: "PGP 2024-26",
    traitQuestions: [
      { traitId: "hangout", question: "Tea Post or Nestlé?", answer: "Tea Post" },
      { traitId: "schedule", question: "Morning or night person?", answer: "Early bird" },
      { traitId: "weekend", question: "Ideal weekend?", answer: "Sports + friends" },
      { traitId: "priority", question: "Career or experiences?", answer: "Career first" },
      { traitId: "study", question: "Study spot?", answer: "Library" },
      { traitId: "social", question: "Party or small group?", answer: "Small group" },
      { traitId: "fitness", question: "Workout routine?", answer: "Daily gym" },
      { traitId: "food", question: "Mess or outside?", answer: "Outside" },
    ],
  },
  {
    id: "profile-2",
    age: 22,
    program: "PGP 2024-26",
    traitQuestions: [
      { traitId: "hangout", question: "Tea Post or Nestlé?", answer: "Room chai" },
      { traitId: "schedule", question: "Morning or night person?", answer: "Night owl" },
      { traitId: "weekend", question: "Ideal weekend?", answer: "Solo reading" },
      { traitId: "priority", question: "Career or experiences?", answer: "Experiences" },
      { traitId: "creative", question: "Creative outlet?", answer: "Writing" },
      { traitId: "social", question: "Party or small group?", answer: "One-on-one" },
      { traitId: "spiritual", question: "Meditation?", answer: "Daily" },
      { traitId: "campus", question: "Favourite spot?", answer: "Heritage walk" },
    ],
  },
  {
    id: "profile-3",
    age: 24,
    program: "PGP 2024-26",
    traitQuestions: [
      { traitId: "hangout", question: "Tea Post or Nestlé?", answer: "Either works" },
      { traitId: "schedule", question: "Morning or night person?", answer: "Flexible" },
      { traitId: "weekend", question: "Ideal weekend?", answer: "Food + chill" },
      { traitId: "priority", question: "Career or experiences?", answer: "Balance" },
      { traitId: "humor", question: "Comedy style?", answer: "Dry humor" },
      { traitId: "social", question: "Party or small group?", answer: "Big parties" },
      { traitId: "food", question: "Mess or outside?", answer: "Foodie life" },
      { traitId: "stress", question: "Stress relief?", answer: "Good food" },
    ],
  },
  {
    id: "profile-4",
    age: 23,
    program: "PGP 2024-26",
    traitQuestions: [
      { traitId: "hangout", question: "Tea Post or Nestlé?", answer: "Vending machine" },
      { traitId: "schedule", question: "Morning or night person?", answer: "Night owl" },
      { traitId: "weekend", question: "Ideal weekend?", answer: "Finish work" },
      { traitId: "priority", question: "Career or experiences?", answer: "Career" },
      { traitId: "academic", question: "Grade focus?", answer: "Top 10%" },
      { traitId: "social", question: "Party or small group?", answer: "Study group" },
      { traitId: "organize", question: "Planning style?", answer: "Very detailed" },
      { traitId: "ambition", question: "5-year goal?", answer: "Leadership" },
    ],
  },
  {
    id: "profile-5",
    age: 22,
    program: "PGP 2024-26",
    traitQuestions: [
      { traitId: "hangout", question: "Tea Post or Nestlé?", answer: "Wherever" },
      { traitId: "schedule", question: "Morning or night person?", answer: "Random" },
      { traitId: "weekend", question: "Ideal weekend?", answer: "Road trip" },
      { traitId: "priority", question: "Career or experiences?", answer: "Stories" },
      { traitId: "creative", question: "Creative outlet?", answer: "Photography" },
      { traitId: "social", question: "Party or small group?", answer: "New people" },
      { traitId: "travel", question: "Travel style?", answer: "Spontaneous" },
      { traitId: "curious", question: "Learning how?", answer: "Conversations" },
    ],
  },
  {
    id: "profile-6",
    age: 25,
    program: "PGP 2024-26",
    traitQuestions: [
      { traitId: "hangout", question: "Tea Post or Nestlé?", answer: "Green tea" },
      { traitId: "schedule", question: "Morning or night person?", answer: "5am club" },
      { traitId: "weekend", question: "Ideal weekend?", answer: "Long run" },
      { traitId: "priority", question: "Career or experiences?", answer: "Self-growth" },
      { traitId: "fitness", question: "Workout routine?", answer: "Yoga daily" },
      { traitId: "social", question: "Party or small group?", answer: "Solo time" },
      { traitId: "spiritual", question: "Meditation?", answer: "Essential" },
      { traitId: "health", question: "Diet?", answer: "Clean eating" },
    ],
  },
  {
    id: "profile-7",
    age: 23,
    program: "PGP 2024-26",
    traitQuestions: [
      { traitId: "hangout", question: "Tea Post or Nestlé?", answer: "Both!" },
      { traitId: "schedule", question: "Morning or night person?", answer: "All-nighter" },
      { traitId: "weekend", question: "Ideal weekend?", answer: "Events" },
      { traitId: "priority", question: "Career or experiences?", answer: "Network" },
      { traitId: "humor", question: "Comedy style?", answer: "Memes" },
      { traitId: "social", question: "Party or small group?", answer: "Big crowd" },
      { traitId: "food", question: "Mess or outside?", answer: "4am Maggi" },
      { traitId: "ambition", question: "5-year goal?", answer: "Consulting" },
    ],
  },
  {
    id: "profile-8",
    age: 22,
    program: "PGP 2024-26",
    traitQuestions: [
      { traitId: "hangout", question: "Tea Post or Nestlé?", answer: "Tea Post" },
      { traitId: "schedule", question: "Morning or night person?", answer: "Midnight" },
      { traitId: "weekend", question: "Ideal weekend?", answer: "Art + music" },
      { traitId: "priority", question: "Career or experiences?", answer: "Meaning" },
      { traitId: "creative", question: "Creative outlet?", answer: "Poetry" },
      { traitId: "social", question: "Party or small group?", answer: "Deep talks" },
      { traitId: "spiritual", question: "Meditation?", answer: "Sometimes" },
      { traitId: "curious", question: "Learning how?", answer: "Books" },
    ],
  },
];
