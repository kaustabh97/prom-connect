import { APP_URL } from "@/config";
import { logError, logInfo } from "./logger";

const REFERRAL_MESSAGE = `Starlit by the Brick – IIMA's anonymous matchmaking for Prom 2026! 💫 Find your date. Campus-only, privacy-first. Join at ${APP_URL}`;

/**
 * Gets the referral share data (same message used on MatchmakingComingSoon + Profile).
 */
export function getReferralShareData() {
  const url = APP_URL;
  const text = `*Starlit by the Bricks* ✨\n\nIIMA exclusive Prom 2026 matching\n\nReal profiles, real people you'll see at prom. Campus-only, verified. No strangers, no awkward first meets.\n\nSet your preferences, swipe through matches, chat when it's mutual. Profile takes 2 mins.\n\n*Everyone's signing up. Don't be the one asking "how did I not know about this?" after prom.*\n\nSign up now: ${url}\n\n_Crafted on Campus, for Campus 💛_`;
  return { text, url, title: "Starlit by the Bricks - Prom 2026" };
}

/**
 * Returns the wa.me URL with the referral message pre-filled.
 */
export function getReferralWhatsAppUrl(): string {
  const { text } = getReferralShareData();
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Opens share dialog (Web Share API on supported devices) or WhatsApp.
 * Same flow as MatchmakingComingSoon "Refer a friend".
 */
export async function handleReferralShare(): Promise<void> {
  logInfo("Referral share initiated", { component: "share", operation: "handleReferralShare" });
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      const { text, url, title } = getReferralShareData();
      await navigator.share({ title, text, url });
      return;
    } catch (err) {
      logError(err, { component: "share", operation: "handleReferralShare" });
    }
  }
  const w = window.open(getReferralWhatsAppUrl(), "_blank", "noopener,noreferrer,width=600,height=400");
  if (w) setTimeout(() => w.close(), 1500);
}

/**
 * Opens WhatsApp with a pre-filled referral message.
 * @deprecated Use handleReferralShare() for the same flow as MatchmakingComingSoon.
 */
export function shareViaWhatsApp(): void {
  logInfo("Share via WhatsApp (referral)", { component: "share", operation: "shareViaWhatsApp" });
  const encoded = encodeURIComponent(REFERRAL_MESSAGE);
  const url = `https://wa.me/?text=${encoded}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Opens WhatsApp with a partner invite message (for IIMA partner not on portal).
 * @param fromName - Name of person inviting
 * @param inviterEmail - Inviter's email (used in ?invite= so partner sees the request)
 * @param personalMessage - Optional personal message, shown after the main invite with an indication
 */
export function sharePartnerInviteViaWhatsApp(
  fromName: string,
  inviterEmail: string,
  personalMessage?: string
): void {
  logInfo("Share partner invite via WhatsApp", { component: "share", operation: "sharePartnerInviteViaWhatsApp", extra: { fromName } });
  const inviteUrl = APP_URL;
  const baseIntro = `*Someone's got a crush on you 💕*\n\n${fromName} wants to go to Prom with you and they're on Starlit by the Brick – IIMA's matchmaking for Prom 2026. Join with the link below and say yes 🥺`;
  const personalSection = personalMessage?.trim()
    ? `\n\n💌 A note from ${fromName}:\n\n_"${personalMessage.trim()}"_`
    : "";
  const message = `${baseIntro}${personalSection}\n\n${inviteUrl}\n\n_Crafted on Campus, for Campus 💛_`;
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
  logInfo("Share prom date via WhatsApp", { component: "share", operation: "sharePromDateViaWhatsApp" });
  const encoded = encodeURIComponent(PROM_DATE_MESSAGE);
  const url = `https://wa.me/?text=${encoded}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export { REFERRAL_MESSAGE };
