/**
 * Application Configuration
 * 
 * This file contains feature flags and configuration settings
 * that can be easily toggled to control app behavior.
 */

// Detect current hostname (browser-only; falls back to empty string in SSR/build)
const HOSTNAME =
  typeof window !== "undefined" ? window.location.hostname : "";

// Primary production domain and beta/staging domains
const PROD_DOMAIN = "starlitbythebricks.in";
const BETA_DOMAIN = "beta.starlitbythebricks.in";

const IS_PROD_DOMAIN = HOSTNAME === PROD_DOMAIN;
const IS_BETA_DOMAIN = HOSTNAME === BETA_DOMAIN;

/**
 * Beta testing mode
 *
 * RAW_BETA_MODE controls whether the app is considered in beta generally.
 * We then hide the visual beta banner on the primary production domain to
 * keep the UX clean, while still showing it on beta / dev domains.
 *
 * When BETA_MODE is true:
 * - Landing page and auth page can show a "Beta" banner at the top.
 *
 * When false:
 * - No beta messaging is shown.
 */
const RAW_BETA_MODE = true;
export const BETA_MODE = RAW_BETA_MODE && !IS_PROD_DOMAIN;

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
 * RAW_GOOGLE_LOGIN_CHECK is the default flag used on non-production domains.
 *
 * Additionally:
 * - On the primary production domain (starlitbythebricks.in), we always
 *   enforce Google OAuth login regardless of RAW_GOOGLE_LOGIN_CHECK so that
 *   real users go through the full auth flow.
 * - On the beta domain (beta.starlitbythebricks.in) and local/dev, you can
 *   still toggle RAW_GOOGLE_LOGIN_CHECK for easier testing.
 */
const RAW_GOOGLE_LOGIN_CHECK = false;
export const GOOGLE_LOGIN_CHECK = IS_PROD_DOMAIN || RAW_GOOGLE_LOGIN_CHECK;

/**
 * Enable/disable matchmaking (Discover, Matches, Chat)
 *
 * When false:
 * - After onboarding, show "Matchmaking will start soon" page
 * - Only Profile page is accessible (no Discover, Matches)
 *
 * When true:
 * - Normal flow: Discover, Matches, Chat, Profile
 */
export const MATCHMAKING_ENABLED = true;
