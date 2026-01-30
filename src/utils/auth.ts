import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";

export interface UserProfile {
  username: string;
  userId: string;
  email?: string;
  name?: string;
  picture?: string;
  fullToken?: any;
}

/**
 * Get the current authenticated user's profile details
 * Use this function anywhere in your app to access user information
 * Returns null if user is not authenticated (no error thrown)
 */
export const getUserProfile = async (): Promise<UserProfile | null> => {
  try {
    // Check session first to avoid unnecessary error
    const session = await fetchAuthSession();
    if (!session.tokens) {
      return null;
    }
    
    const user = await getCurrentUser();
    
    const profile: UserProfile = {
      username: user.username,
      userId: user.userId,
      email: session.tokens?.idToken?.payload.email as string | undefined,
      name: session.tokens?.idToken?.payload.name as string | undefined,
      picture: session.tokens?.idToken?.payload.picture as string | undefined,
      fullToken: session.tokens?.idToken?.payload,
    };
    
    return profile;
  } catch (error: any) {
    // Silently return null for unauthenticated users (expected behavior)
    // Only log unexpected errors
    if (error?.name !== "UserUnAuthenticatedException") {
      console.error("Unexpected error fetching user profile:", error);
    }
    return null;
  }
};

/**
 * Log user profile details to console (useful for debugging)
 * Only logs if user is authenticated
 */
export const logUserProfile = async () => {
  try {
    const session = await fetchAuthSession();
    if (!session.tokens) {
      console.log("No active session - user is not authenticated");
      return null;
    }
    
    const user = await getCurrentUser();
    
    console.log("=== Current User Profile ===");
    console.log("User:", user);
    console.log("Session:", session);
    console.log("ID Token Payload:", session.tokens?.idToken?.payload);
    console.log("Email:", session.tokens?.idToken?.payload.email);
    console.log("Name:", session.tokens?.idToken?.payload.name);
    console.log("Picture:", session.tokens?.idToken?.payload.picture);
    console.log("===========================");
    
    return {
      user,
      session,
      email: session.tokens?.idToken?.payload.email,
      name: session.tokens?.idToken?.payload.name,
      picture: session.tokens?.idToken?.payload.picture,
    };
  } catch (error: any) {
    if (error?.name === "UserUnAuthenticatedException") {
      console.log("User is not authenticated");
    } else {
      console.error("Error fetching user profile:", error);
    }
    return null;
  }
};

/**
 * Check if user is currently authenticated (without throwing errors)
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const session = await fetchAuthSession();
    return !!session.tokens;
  } catch {
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

    console.log("agrdipak")
    console.log(JSON.stringify(outputs, null, 2));
    const cognitoDomain = outputs.default.auth.oauth?.domain;
    if (!cognitoDomain) {
      throw new Error("Cognito domain not found in amplify_outputs.json");
    }
    // This is the URL that Google will redirect to after authentication
    const redirectUrl = `https://${cognitoDomain}/oauth2/idpresponse`;
    return redirectUrl;
  } catch (error) {
    console.error("Error getting OAuth redirect URL:", error);
    return "";
  }
};

/**
 * Log OAuth configuration details for debugging
 */
export const logOAuthConfig = async () => {
  try {
    const outputs = await import("../../amplify_outputs.json");
    const cognitoDomain = outputs.default.auth.oauth?.domain;
    const callbackUrls = outputs.default.auth.oauth?.redirect_sign_in_uri;
    
    console.log("=== OAuth Configuration ===");
    console.log("Cognito Hosted UI Domain:", cognitoDomain);
    console.log("Callback URLs (where Cognito redirects after auth):", callbackUrls);
    console.log("");
    
    const redirectUrl = await getGoogleOAuthRedirectUrl();
    console.log("🔑 IMPORTANT: Add this URL to Google OAuth Console:");
    console.log(`   ${redirectUrl}`);
    console.log("");
    console.log("The flow is:");
    console.log("1. User clicks 'Sign in with Google'");
    console.log("2. Redirects to Cognito Hosted UI");
    console.log("3. Cognito redirects to Google OAuth");
    console.log("4. Google redirects back to:", redirectUrl);
    console.log("5. Cognito processes auth and redirects to:", callbackUrls?.[0]);
    console.log("===========================");
  } catch (error) {
    console.error("Error logging OAuth config:", error);
  }
};
