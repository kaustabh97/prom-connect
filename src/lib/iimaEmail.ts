/**
 * IIMA email parsing for discovery scoring.
 * Format: [prefix]firstname[@iima.ac.in]
 * - Prefix: phdXX, pXX, fXX, afpXX, bpgpXX, xXX (letters + digits); or none.
 * - Name: first name only; may have 1–2 extra letters at the end for same-name disambiguation
 *   (e.g. p24akash@iima.ac.in, p24akashd@iima.ac.in).
 */

const IIMA_DOMAIN = "@iima.ac.in";

/** Regex: optional prefix (letters + digits), then first name (letters only; optional 1–2 letter suffix), then domain */
const PREFIX_PATTERN = /^(?:[a-z]+\d+)?([a-z]+)@iima\.ac\.in$/i;

/**
 * Extracts the name part from an IIMA email (first name, possibly + 1–2 letter suffix).
 * e.g. p24akash@iima.ac.in → "akash", p24akashd@iima.ac.in → "akashd"
 * Returns null if not a valid IIMA email.
 */
export function parseIIMAEmailName(email: string): string | null {
  if (!email || typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.endsWith(IIMA_DOMAIN)) return null;
  const match = trimmed.match(PREFIX_PATTERN);
  if (!match || !match[1]) return null;
  const namePart = match[1].trim();
  return namePart.length > 0 ? namePart : null;
}

/**
 * First name from display name (first word, lowercase).
 */
function firstName(displayName: string): string {
  const n = (displayName || "").trim().toLowerCase().replace(/\s+/g, " ").split(/\s+/)[0];
  return n || "";
}

/**
 * Checks if the name extracted from the email matches the display name.
 * Email is always first name only, with optional 1–2 letter suffix (e.g. akash, akashd).
 * Match if: email name equals display first name, or email name is display first name + 1–2 letters.
 */
export function emailNameMatchesDisplayName(email: string, displayName: string): boolean {
  const emailName = parseIIMAEmailName(email);
  if (!emailName || !displayName?.trim()) return false;
  const displayFirst = firstName(displayName);
  if (!displayFirst) return false;
  if (emailName === displayFirst) return true;
  if (emailName.startsWith(displayFirst) && emailName.length <= displayFirst.length + 2) return true;
  if (displayFirst.startsWith(emailName) && displayFirst.length <= emailName.length + 2) return true;
  return false;
}
