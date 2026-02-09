/**
 * Ensure mutual likes are converted into Match records.
 * Runs on a schedule (every hour) to backfill any missed matches.
 *
 * For any pair of users A,B where Like(A->B) and Like(B->A) exist,
 * if there is no Match between A and B, create an active Match.
 */

export const handler = async (): Promise<{ created: number; error?: string }> => {
  const startTime = new Date().toISOString();
  console.log("[ensure-mutual-matches] Starting cron job at", startTime);
  
  try {
    const { getAmplifyDataClientConfig } = await import("@aws-amplify/backend/function/runtime");
    const { Amplify } = await import("aws-amplify");
    const { generateClient } = await import("aws-amplify/data");
    const env = (await import("$amplify/env/ensure-mutual-matches")).env;
    const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
    Amplify.configure(resourceConfig, libraryOptions);
    type Schema = import("../../data/resource").Schema;
    const client = generateClient<Schema>();

    // Build email map: UserProfile id -> email (for Match metadata)
    const emailById: Record<string, string | undefined> = {};
    let profileNextToken: string | undefined;
    do {
      const res = await client.models.UserProfile.list({ nextToken: profileNextToken });
      (res.data ?? []).forEach((p) => {
        if (p.id) {
          emailById[p.id] = p.email ?? undefined;
        }
      });
      profileNextToken = res.nextToken ?? undefined;
    } while (profileNextToken);

    // List all Likes
    const likedBy: Record<string, Set<string>> = {};
    let likeNextToken: string | undefined;
    do {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const likeRes = await (client.models.Like as any).list({ nextToken: likeNextToken });
      const page = (likeRes.data ?? []) as { fromUserId?: string | null; toUserId?: string | null }[];
      for (const like of page) {
        const from = like.fromUserId ?? undefined;
        const to = like.toUserId ?? undefined;
        if (!from || !to || from === to) continue;
        if (!likedBy[from]) likedBy[from] = new Set<string>();
        likedBy[from]!.add(to);
      }
      likeNextToken = likeRes.nextToken ?? undefined;
    } while (likeNextToken);

    // List existing Matches to avoid duplicates
    const existingPairs = new Set<string>(); // key: "minId|maxId"
    let matchNextToken: string | undefined;
    do {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matchRes = await (client.models.Match as any).list({ nextToken: matchNextToken });
      const page = (matchRes.data ?? []) as { user1Id?: string | null; user2Id?: string | null }[];
      for (const m of page) {
        const u1 = m.user1Id ?? undefined;
        const u2 = m.user2Id ?? undefined;
        if (!u1 || !u2 || u1 === u2) continue;
        const a = u1 < u2 ? u1 : u2;
        const b = u1 < u2 ? u2 : u1;
        existingPairs.add(`${a}|${b}`);
      }
      matchNextToken = matchRes.nextToken ?? undefined;
    } while (matchNextToken);

    // For each mutual-like pair without a Match, create a Match
    let created = 0;
    const checkedPairs = new Set<string>();

    for (const [from, tos] of Object.entries(likedBy)) {
      for (const to of tos) {
        if (!likedBy[to] || !likedBy[to]!.has(from)) continue; // not mutual
        if (from === to) continue;

        const a = from < to ? from : to;
        const b = from < to ? to : from;
        const pairKey = `${a}|${b}`;
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        if (existingPairs.has(pairKey)) continue; // Match already exists

        const user1Id = a;
        const user2Id = b;
        const user1Email = emailById[user1Id];
        const user2Email = emailById[user2Id];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client.models.Match as any).create({
          user1Id,
          user2Id,
          user1Email,
          user2Email,
          status: "active",
          createdAt: new Date().toISOString(),
        });
        created += 1;
      }
    }

    console.log("[ensure-mutual-matches] created", created, "matches");
    return { created };
  } catch (err) {
    const endTime = new Date().toISOString();
    console.error("[ensure-mutual-matches] Failed:", {
      error: err,
      startTime,
      endTime,
      durationMs: new Date(endTime).getTime() - new Date(startTime).getTime(),
    });
    const message = err instanceof Error ? err.message : String(err);
    return { created: 0, error: message };
  }
};

