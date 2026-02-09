/**
 * Compute discovery scores for all discovery-eligible profiles.
 * Score = email-name match + age sanity + popularity + completeness + recency.
 * Age > MAX_REALISTIC_AGE → score forced to 0 (negative age band).
 * Run on schedule (EventBridge) or via custom query.
 */

const MAX_REALISTIC_AGE = 60;
const WEIGHT_EMAIL_NAME = 0.18;
const WEIGHT_AGE_SANITY = 0.18;
const WEIGHT_POPULARITY = 0.52;
const WEIGHT_COMPLETENESS = 0.08;
const WEIGHT_RECENCY = 0.04;
const RECENCY_DAYS_DECAY = 90;

/** Count filled discovery-relevant fields (bio, cohort, gender, intention, lifestyle, polls). Returns 0–1. */
function completenessFactor(p: Record<string, unknown>): number {
  const fields = [
    "bio", "cohort", "gender", "intention", "hometown",
    "alcoholPreference", "smokingPreference", "foodPreference", "favouritePlace", "teaOrCoffee", "mountainOrBeach",
    "poll145Surprises", "pollMaggiOrChai", "pollSectionOrBatch", "pollDormOrLibrary", "pollNetflixOrGoingOut",
    "pollTextingOrCalling", "pollSurpriseOrPlanned", "pollDeepOrSilly", "pollBoredInRoom", "pollCasualOrDressed",
  ];
  let filled = 0;
  for (const key of fields) {
    const v = p[key];
    if (v != null && typeof v === "string" && v.trim() !== "") filled += 1;
  }
  return filled / fields.length;
}

/** Recency factor 0–1: 1 if updated within RECENCY_DAYS_DECAY days, linear decay after. */
function recencyFactor(updatedAt: string | null | undefined): number {
  if (!updatedAt) return 0;
  const updated = new Date(updatedAt).getTime();
  const now = Date.now();
  const daysSince = (now - updated) / (24 * 60 * 60 * 1000);
  if (daysSince <= 0) return 1;
  if (daysSince >= RECENCY_DAYS_DECAY) return 0;
  return 1 - daysSince / RECENCY_DAYS_DECAY;
}

// Email: [prefix]firstname@iima.ac.in; first name only, optional 1–2 letter suffix (e.g. p24akash, p24akashd)
function parseIIMAEmailName(email: string): string | null {
  if (!email || typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.endsWith("@iima.ac.in")) return null;
  const match = trimmed.match(/^(?:[a-z]+\d+)?([a-z]+)@iima\.ac\.in$/i);
  if (!match || !match[1]) return null;
  const namePart = match[1].trim();
  return namePart.length > 0 ? namePart : null;
}

function firstName(displayName: string): string {
  const n = (displayName || "").trim().toLowerCase().replace(/\s+/g, " ").split(/\s+/)[0];
  return n || "";
}

function emailNameMatchesDisplayName(email: string, displayName: string): boolean {
  const emailName = parseIIMAEmailName(email);
  if (!emailName || !displayName?.trim()) return false;
  const displayFirst = firstName(displayName);
  if (!displayFirst) return false;
  if (emailName === displayFirst) return true;
  if (emailName.startsWith(displayFirst) && emailName.length <= displayFirst.length + 2) return true;
  if (displayFirst.startsWith(emailName) && displayFirst.length <= emailName.length + 2) return true;
  return false;
}

export const handler = async (): Promise<{ updated: number; error?: string }> => {
  const startTime = new Date().toISOString();
  console.log("[compute-discovery-scores] Starting cron job at", startTime);
  
  try {
    const { getAmplifyDataClientConfig } = await import("@aws-amplify/backend/function/runtime");
    const { Amplify } = await import("aws-amplify");
    const { generateClient } = await import("aws-amplify/data");
    const env = (await import("$amplify/env/compute-discovery-scores")).env;
    const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
    Amplify.configure(resourceConfig, libraryOptions);
    type Schema = import("../../data/resource").Schema;
    const client = generateClient<Schema>();

    type ProfileRow = Schema["UserProfile"]["type"];
    const allProfiles: ProfileRow[] = [];
    let nextToken: string | undefined;
    do {
      const res = await client.models.UserProfile.list({ nextToken });
      allProfiles.push(...(res.data ?? []));
      nextToken = res.nextToken ?? undefined;
    } while (nextToken);

    const discoveryEligible = allProfiles.filter(
      (p) =>
        p.id &&
        p.onboardingCompleted === true &&
        p.excludeFromDiscovery !== true &&
        !(typeof p.bio === "string" && p.bio.trim().startsWith("Partner:"))
    );

    const likeCountByToUserId: Record<string, number> = {};
    let likeNextToken: string | undefined;
    do {
      const likeRes = await (client.models.Like as { list: (opts: unknown) => Promise<{ data?: { toUserId?: string }[]; nextToken?: string }> }).list(
        { nextToken: likeNextToken }
      );
      const page = likeRes.data ?? [];
      for (const like of page) {
        const to = like.toUserId;
        if (to) likeCountByToUserId[to] = (likeCountByToUserId[to] ?? 0) + 1;
      }
      likeNextToken = likeRes.nextToken ?? undefined;
    } while (likeNextToken);

    const maxLikes = Math.max(1, ...Object.values(likeCountByToUserId));

    const now = new Date().toISOString();
    let updated = 0;
    for (const profile of discoveryEligible) {
      const id = profile.id!;
      const emailMatch = emailNameMatchesDisplayName(profile.email ?? "", profile.name ?? "") ? 1 : 0;
      const age = profile.age ?? null;
      const ageSanity = age != null && age <= MAX_REALISTIC_AGE ? 1 : 0;
      // Negative age band (8): if age > 60, force score to 0
      if (age != null && age > MAX_REALISTIC_AGE) {
        await client.models.UserProfile.update({
          id,
          email: profile.email ?? undefined,
          discoveryScore: 0,
          lastDiscoveryScoreAt: now,
        } as Parameters<typeof client.models.UserProfile.update>[0]);
        updated += 1;
        continue;
      }
      const likes = likeCountByToUserId[id] ?? 0;
      const popularityNorm = likes / maxLikes;
      const completeness = completenessFactor(profile as Record<string, unknown>);
      const recency = recencyFactor(profile.updatedAt ?? undefined);
      const score =
        WEIGHT_EMAIL_NAME * emailMatch +
        WEIGHT_AGE_SANITY * ageSanity +
        WEIGHT_POPULARITY * popularityNorm +
        WEIGHT_COMPLETENESS * completeness +
        WEIGHT_RECENCY * recency;

      await client.models.UserProfile.update({
        id,
        email: profile.email ?? undefined,
        discoveryScore: Math.round(score * 100) / 100,
        lastDiscoveryScoreAt: now,
      } as Parameters<typeof client.models.UserProfile.update>[0]);
      updated += 1;
    }

    const endTime = new Date().toISOString();
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    console.log("[compute-discovery-scores] Completed successfully:", {
      updated,
      totalProfiles: allProfiles.length,
      eligibleProfiles: discoveryEligible.length,
      startTime,
      endTime,
      durationMs,
    });
    return { updated };
  } catch (err) {
    const endTime = new Date().toISOString();
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    console.error("[compute-discovery-scores] Failed:", {
      error: err,
      startTime,
      endTime,
      durationMs,
    });
    const message = err instanceof Error ? err.message : String(err);
    return { updated: 0, error: message };
  }
};
