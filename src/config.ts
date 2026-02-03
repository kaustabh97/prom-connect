/**
 * Application Configuration
 * 
 * This file contains feature flags and configuration settings
 * that can be easily toggled to control app behavior.
 */

/** Base URL for the Prom Connect app (used in partner invite emails) */
export const APP_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : (import.meta.env?.VITE_APP_URL as string) || "https://prom-connect.example.com";

/**
 * Enable/disable backend profile fetching
 * 
 * When set to false:
 * - hasCompletedOnboarding() will always return false
 * - Profile page will not fetch from backend
 * - Users will always go through onboarding flow
 * 
 * When set to true:
 * - Backend checks will be performed normally
 * - Existing profiles will be fetched and checked
 */
export const ENABLE_BACKEND_PROFILE_FETCH = true;

/**
 * Enable/disable Google login requirement
 * 
 * When set to false:
 * - Google OAuth login is bypassed
 * - Users can enter any email address to sign in
 * - Email-based authentication (no password required)
 * - User profiles are still saved to backend database
 * - Useful for testing and creating multiple profiles
 * 
 * When set to true:
 * - Google OAuth login is required
 * - Users must sign in with their Google account
 * - Full authentication flow with Cognito
 * - User profiles are saved to backend database
 */
export const GOOGLE_LOGIN_CHECK = false;
