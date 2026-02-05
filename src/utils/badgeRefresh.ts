/** Event to trigger badge count refresh (Prom Ask, partner requests, matches) */
export const BADGE_REFRESH_EVENT = "prom-connect:badge-refresh";

export function dispatchBadgeRefresh(): void {
  window.dispatchEvent(new CustomEvent(BADGE_REFRESH_EVENT));
}

/** Event when user opens/closes a chat – used to avoid marking as unread while viewing */
export const VIEWING_MATCH_EVENT = "prom-connect:viewing-match";

export function dispatchViewingMatch(matchId: string | null): void {
  window.dispatchEvent(new CustomEvent(VIEWING_MATCH_EVENT, { detail: { matchId } }));
}
