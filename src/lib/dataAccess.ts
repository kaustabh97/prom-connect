/**
 * Data access helpers.
 *
 * Rule: when a single record is needed and you have its id, use .get({ id }).
 * - Single user profile → getUserProfileById(profileId) (uses UserProfile.get)
 * - Single match → Match.get({ id: matchId })
 * - Single conversation → Conversation.get({ id })
 * Use .list() or listByX only when you need multiple records or query by index.
 */

import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

const client = generateClient<Schema>();

type AuthOpts = { authMode?: "apiKey" | "userPool" };

/**
 * Fetch a single user profile by id. Use this (or UserProfile.get({ id })) when you need one user's data.
 * Do not use UserProfile.list + find when you have the profile id.
 */
export async function getUserProfileById(
  profileId: string,
  opts?: AuthOpts
): Promise<{ data: Schema["UserProfile"]["type"] | undefined; errors?: unknown[] }> {
  return client.models.UserProfile.get({ id: profileId }, opts as Parameters<typeof client.models.UserProfile.get>[1]);
}
