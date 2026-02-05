import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { getUserProfile } from "@/utils/auth";
import { GOOGLE_LOGIN_CHECK } from "@/config";

const client = generateClient<Schema>();

/**
 * Returns the path to redirect to if the user has a prom date (IIMA match or outside partner).
 * Returns null if they don't have a prom date.
 */
export async function getPromDateRedirectPath(): Promise<string | null> {
  const profile = await getUserProfile();
  if (!profile?.email) return null;

  const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
  const opts = authMode ? { authMode } : undefined;

  const { data: profiles } = await client.models.UserProfile.list(
    { filter: { email: { eq: profile.email } } },
    opts
  );
  if (!profiles?.[0]) return null;
  const userProfile = profiles[0];
  const userId = userProfile.id;

  // Check IIMA match (prom date via Match record)
  const [as1, as2] = await Promise.all([
    client.models.Match.listMatchByUser1Id({ user1Id: userId }, opts),
    client.models.Match.listMatchByUser2Id({ user2Id: userId }, opts),
  ]);
  const all = [...(as1.data ?? []), ...(as2.data ?? [])];
  if (all.some((m) => m.status === "active" && m.isPromDate)) {
    return "/prom-date";
  }

  // Check outside partner (bio starts with "Partner: ")
  const bio = userProfile.bio;
  const partnerMatch = bio?.match(/^Partner:\s*(.+)/);
  if (partnerMatch) {
    const partnerName = partnerMatch[1].trim();
    return `/prom-date?partnerName=${encodeURIComponent(partnerName)}&outside=1`;
  }

  return null;
}
