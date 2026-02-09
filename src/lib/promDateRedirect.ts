import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { getUserProfileFromCognito } from "@/utils/auth";
import { getIdFromEmail } from "@/utils/userId";
import { logError } from "@/utils/logger";
import { GOOGLE_LOGIN_CHECK } from "@/config";
import { getUserProfileById } from "@/lib/dataAccess";

const client = generateClient<Schema>();

/**
 * Returns the path to redirect to based on user's partner status.
 * - "/prom-date" when they have a confirmed prom date (IIMA Match or outside partner)
 * - "/request-pending" when they've sent a partner invite (IIMA) that's still pending
 * - null when they should go to discover/matches/profile
 */
export async function getPromDateRedirectPath(): Promise<string | null> {
  try {
    const profile = await getUserProfileFromCognito();
    if (!profile?.email) return null;

    const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
    const opts = authMode ? { authMode } : undefined;

    const profileId = getIdFromEmail(profile.email.trim());
    const { data: userProfile } = await getUserProfileById(profileId, opts);
    if (!userProfile) return null;
    const userId = userProfile.id;
    const bio = userProfile.bio;

    // 1. Check IIMA match (prom date via Match record - both accepted)
    const [as1, as2] = await Promise.all([
      client.models.Match.listMatchByUser1Id({ user1Id: userId }, opts),
      client.models.Match.listMatchByUser2Id({ user2Id: userId }, opts),
    ]);
    const all = [...(as1.data ?? []), ...(as2.data ?? [])];
    if (all.some((m) => m.status === "active" && m.isPromDate)) {
      return "/prom-date";
    }

    // 2. Check pending partner request (IIMA couple flow - sent invite, waiting for acceptance)
    const { data: outgoingRequests } = await client.models.MatchRequest.listMatchRequestByFromUserId(
      { fromUserId: userId },
      opts
    );
    const pendingSent = (outgoingRequests ?? []).filter((r) => r.status === "pending");
    if (pendingSent.length > 0) {
      return "/request-pending";
    }

    // 3. Outside partner (bio "Partner: X" OR partnerEmail set with no MatchRequest - partner from outside campus)
    // If we had MatchRequests from me (declined/withdrawn), don't treat as outside - go to discover
    const hasAnyOutgoingRequest = (outgoingRequests ?? []).length > 0;
    if (hasAnyOutgoingRequest) {
      return null; // IIMA flow but request was declined/withdrawn
    }
    
    // Check for outside partner: bio starts with "Partner:" OR partnerEmail is set (non-IIMA)
    const partnerEmail = userProfile.partnerEmail ?? "";
    const hasNonIIMAPartnerEmail = partnerEmail.trim() !== "" && !partnerEmail.endsWith("@iima.ac.in");
    const partnerMatch = bio?.match(/^Partner:\s*(.+)/);
    
    // Only redirect to prom-date if:
    // - Bio starts with "Partner:" AND partnerStatus indicates they have a partner
    // - OR partnerEmail is set (non-IIMA) AND partnerStatus indicates they have a partner
    // But NOT if partnerStatus is "Still looking" (user switched back to discovery)
    const partnerStatus = userProfile.partnerStatus ?? "";
    const hasPartner = partnerStatus.includes("Already found") || partnerStatus.includes("plus-one");
    
    if (hasPartner && (partnerMatch || hasNonIIMAPartnerEmail)) {
      const partnerName = partnerMatch?.[1]?.trim() || userProfile.partnerName || "Partner";
      return `/prom-date?partnerName=${encodeURIComponent(partnerName)}&outside=1`;
    }

    return null;
  } catch (err) {
    logError(err, { component: "promDateRedirect", operation: "getPromDateRedirectPath" });
    return null;
  }
}
