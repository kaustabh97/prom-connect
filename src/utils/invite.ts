import { logInfo } from "./logger";

/** SessionStorage key for invite context (who invited the current user) */
const INVITE_FROM_KEY = "prom_invite_from";

/**
 * Capture ?invite=email from URL and store in sessionStorage.
 * Call on app load so we preserve invite context across auth redirects.
 */
export function captureInviteFromUrl(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const invite = params.get("invite");
  if (invite && invite.includes("@")) {
    sessionStorage.setItem(INVITE_FROM_KEY, invite);
    logInfo("Invite captured from URL", { component: "invite", operation: "captureInviteFromUrl", extra: { invite } });
  }
}

/** Get stored invite-from email, if any */
export function getInviteFrom(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(INVITE_FROM_KEY);
}

/** Clear stored invite (after accept/decline or when no longer needed) */
export function clearInviteFrom(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(INVITE_FROM_KEY);
}
