/**
 * Generate a deterministic UserProfile id from email only.
 * Same email always produces the same id, regardless of name or other fields.
 * Used to ensure chat/matches work correctly when the same person has different name spellings.
 */
export function getIdFromEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const safe = normalized.replace(/[^a-z0-9._-]/g, "_");
  return `user_${safe}`;
}
