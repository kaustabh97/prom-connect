import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { logError, logInfo } from "./logger";
import { ENABLE_BACKEND_PROFILE_FETCH, GOOGLE_LOGIN_CHECK } from "@/config";

const client = generateClient<Schema>();

// Test mode user storage key
const TEST_USER_STORAGE_KEY = "prom_connect_test_user";

export interface UserProfile {
  username: string;
  userId: string;
  email?: string;
  name?: string;
  picture?: string;
  fullToken?: any;
}

/**
 * Set test user (for development/testing when Google login is disabled)
 */
export const setTestUser = (email: string, name?: string): void => {
  if (!GOOGLE_LOGIN_CHECK) {
    const testUser: UserProfile = {
      username: email.split("@")[0],
      userId: `test_${email.replace(/[^a-zA-Z0-9]/g, "_")}`,
      email,
      name: name || email.split("@")[0],
      picture: undefined,
    };
    localStorage.setItem(TEST_USER_STORAGE_KEY, JSON.stringify(testUser));
  }
};

/**
 * Get test user from localStorage
 */
export const getTestUser = (): UserProfile | null => {
  if (!GOOGLE_LOGIN_CHECK) {
    const stored = localStorage.getItem(TEST_USER_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as UserProfile;
      } catch {
        return null;
      }
    }
  }
  return null;
};

/**
 * Clear test user (for logout in test mode)
 */
export const clearTestUser = (): void => {
  localStorage.removeItem(TEST_USER_STORAGE_KEY);
};

/**
 * Get the current authenticated user's profile details
 * Use this function anywhere in your app to access user information
 * Returns null if user is not authenticated (no error thrown)
 * 
 * In test mode (GOOGLE_LOGIN_CHECK = false), returns test user from localStorage
 */
export const getUserProfile = async (): Promise<UserProfile | null> => {
  const context = { component: "auth", operation: "getUserProfile" };

  // If Google login is disabled, use test user from localStorage
  if (!GOOGLE_LOGIN_CHECK) {
    const testUser = getTestUser();
    if (testUser) {
      logInfo("Returning test user from localStorage", { ...context, extra: { hasEmail: !!testUser.email } });
      return testUser;
    }
    logInfo("No test user in localStorage", context);
    return null;
  }

  // Normal flow: use Cognito authentication
  try {
    // Check session first to avoid unnecessary error
    const session = await fetchAuthSession();
    if (!session.tokens) {
      logInfo("No session tokens", context);
      return null;
    }

    const user = await getCurrentUser();
    logInfo("Got current user from Cognito", {
      ...context,
      extra: { hasUserId: !!user?.userId, hasUsername: !!user?.username },
    });

    const payload = session.tokens?.idToken?.payload as Record<string, unknown> | undefined;
    const email = payload?.email as string | undefined;
    let name = payload?.name as string | undefined;
    // If name is missing or equals email, use Google profile: given_name + family_name
    if (!name || (email && name === email)) {
      const givenName = payload?.given_name as string | undefined;
      const familyName = payload?.family_name as string | undefined;
      if (givenName || familyName) {
        name = [givenName, familyName].filter(Boolean).join(" ").trim();
      }
    }
    if (!name && email) {
      name = email.split("@")[0];
    }
    const picture = payload?.picture as string | undefined;

    logInfo("Token payload values for profile", {
      ...context,
      extra: { hasEmail: !!email, hasName: !!name, hasPicture: !!picture },
    });

    const profile: UserProfile = {
      username: user.username,
      userId: user.userId,
      email,
      name: name || undefined,
      picture,
      fullToken: payload,
    };

    logInfo("Returning Cognito user profile", { ...context, extra: { hasEmail: !!email, hasName: !!name } });
    return profile;
  } catch (error: unknown) {
    // Silently return null for unauthenticated users (expected behavior)
    const err = error as { name?: string };
    if (err?.name !== "UserUnAuthenticatedException") {
      logError(error, context);
    } else {
      logInfo("User not authenticated (expected)", { ...context, extra: { reason: err?.name } });
    }
    return null;
  }
};

/**
 * Check if user is currently authenticated (without throwing errors)
 * In test mode, checks if test user exists in localStorage
 */
export const isAuthenticated = async (): Promise<boolean> => {
  // If Google login is disabled, check for test user
  if (!GOOGLE_LOGIN_CHECK) {
    return !!getTestUser();
  }

  // Normal flow: check Cognito session
  try {
    const session = await fetchAuthSession();
    return !!session.tokens;
  } catch (err) {
    logError(err, { component: "auth", operation: "isAuthenticated" });
    return false;
  }
};

/**
 * Check if user has completed onboarding by checking their UserProfile
 * Returns true if onboardingCompleted is true, false otherwise
 * 
 * Respects ENABLE_BACKEND_PROFILE_FETCH config flag
 * When Google login is disabled, always checks backend (ignores ENABLE_BACKEND_PROFILE_FETCH)
 */
export const hasCompletedOnboarding = async (): Promise<boolean> => {
  // If Google login is disabled, always check backend (profiles are saved there)
  const shouldCheckBackend = !GOOGLE_LOGIN_CHECK || ENABLE_BACKEND_PROFILE_FETCH;
  
  if (!shouldCheckBackend) {
    return false;
  }

  try {
    const profile = await getUserProfile();
    if (!profile || !profile.email) {
      return false;
    }

    // In production (Google login), use userPool so we fetch the user's profile with their JWT.
    // When Google login is disabled, use API key.
    const authMode = GOOGLE_LOGIN_CHECK ? ('userPool' as const) : ('apiKey' as const);
    const filters = {
      filter: {
        email: {
          eq: profile.email,
        },
      },
    };
    const opts = { authMode };
    // @ts-ignore - authMode option not in generated types yet
    const { data: profiles, errors } = await client.models.UserProfile.list(filters, opts);

    if (errors || !profiles || profiles.length === 0) {
      return false;
    }

    const userProfile = profiles[0];
    return userProfile.onboardingCompleted === true;
  } catch (error) {
    logError(error, { component: "auth", operation: "hasCompletedOnboarding" });
    return false;
  }
};

/**
 * Get the OAuth redirect URL that should be added to Google OAuth Console
 * This is the Cognito Hosted UI URL, not your localhost URL
 */
export const getGoogleOAuthRedirectUrl = async (): Promise<string> => {
  try {
    const outputs = await import("../../amplify_outputs.json");
    const cognitoDomain = outputs.default.auth.oauth?.domain;
    if (!cognitoDomain) {
      throw new Error("Cognito domain not found in amplify_outputs.json");
    }
    // This is the URL that Google will redirect to after authentication
    const redirectUrl = `https://${cognitoDomain}/oauth2/idpresponse`;
    return redirectUrl;
  } catch (error) {
    logError(error, { component: "auth", operation: "getOAuthRedirectUrl" });
    return "";
  }
};

