/** Event to trigger badge count refresh (Prom Ask, partner requests, matches) */
export const BADGE_REFRESH_EVENT = "prom-connect:badge-refresh";

export function dispatchBadgeRefresh(): void {
  window.dispatchEvent(new CustomEvent(BADGE_REFRESH_EVENT));
}
