import { APP_URL } from "@/config";

const REFERRAL_MESSAGE = `Starlit by the Brick – IIMA's anonymous matchmaking for Prom 2026! 💫 Find your date. Campus-only, privacy-first. Join at ${APP_URL}`;

/**
 * Opens WhatsApp with a pre-filled referral message.
 * User can then select contacts to send it to.
 */
export function shareViaWhatsApp(): void {
  const encoded = encodeURIComponent(REFERRAL_MESSAGE);
  const url = `https://wa.me/?text=${encoded}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Opens WhatsApp with a partner invite message (for IIMA partner not on portal).
 * @param fromName - Name of person inviting
 * @param inviterEmail - Inviter's email (used in ?invite= so partner sees the request)
 */
export function sharePartnerInviteViaWhatsApp(fromName: string, inviterEmail: string): void {
  const inviteUrl = `${APP_URL}?invite=${encodeURIComponent(inviterEmail)}`;
  const message = `Hey! ${fromName} wants to go to Prom with you 💫\n\nThey're on Starlit by the Brick – IIMA's anonymous matchmaking for Prom 2026. Join and accept their request:\n${inviteUrl}`;
  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/?text=${encoded}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

const PROM_DATE_MESSAGE = `We're going to Prom together! 💫 Save the date – 15th Feb, 8 PM\n\nStarlit by the Brick | Prom 2026 – IIM Ahmedabad`;

/**
 * Opens WhatsApp with a pre-filled prom date message.
 * Same pattern as partner invite – wa.me only supports text, not images.
 * User can add the saved image from their gallery if they've downloaded it.
 */
export function sharePromDateViaWhatsApp(): void {
  const encoded = encodeURIComponent(PROM_DATE_MESSAGE);
  const url = `https://wa.me/?text=${encoded}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export { REFERRAL_MESSAGE };
