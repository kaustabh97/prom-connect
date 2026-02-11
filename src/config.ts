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
const RAW_BETA_MODE = false;
export const BETA_MODE = RAW_BETA_MODE && !IS_PROD_DOMAIN;

/** Base URL for Starlit by the Brick (used in partner invite emails) */
export const APP_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : (import.meta.env?.VITE_APP_URL as string) || "https://starlitbythebricks.in";

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
 * - On non-main branches: always enabled.
 * - On main: enabled only from 12 AM on 9 Feb (IST) onwards.
 * Set at build time via VITE_AMPLIFY_BRANCH (injected by Amplify from AWS_BRANCH).
 * When VITE_AMPLIFY_BRANCH is unset (e.g. local dev), matchmaking is enabled.
 *
 * When false:
 * - After onboarding, show "Matchmaking will start soon" page
 * - Only Profile page is accessible (no Discover, Matches)
 *
 * When true:
 * - Normal flow: Discover, Matches, Chat, Profile
 */
const AMPLIFY_BRANCH = import.meta.env.VITE_AMPLIFY_BRANCH as string | undefined;

/** 12 AM on 9 Feb (IST) – matchmaking goes live on main at this time */
export const MATCHMAKING_GO_LIVE_DATE = "2026-02-09T00:00:00+05:30";

export function getMatchmakingEnabled(): boolean {
  if (AMPLIFY_BRANCH !== "main") return true;
  return Date.now() >= new Date(MATCHMAKING_GO_LIVE_DATE).getTime();
}

/**
 * Admin profile emails: these users are hidden from the discovery feed
 * (other users will not see them when browsing Discover).
 * Add or remove emails here to control who is excluded from discovery.
 */
export const DISCOVERY_HIDDEN_PROFILE_EMAILS: string[] = [
  "p24kaustabh@iima.ac.in",
  "p24dipak@iima.ac.in",
  "p24sushruti@iima.ac.in",
];
