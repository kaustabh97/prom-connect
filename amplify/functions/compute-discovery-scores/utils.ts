/**
 * Utility functions for Lambda handlers that work with Amplify Data.
 */

import type { Schema } from "../../data/resource";
import type { Client } from "aws-amplify/data";

/**
 * Fetch all UserProfile records with pagination.
 * Handles pagination automatically and returns all profiles.
 * 
 * @param client - Amplify Data client instance
 * @param options - Optional list options (filter, limit, etc.)
 * @returns Promise resolving to array of all UserProfile records
 */
export async function fetchAllUserProfiles(
  client: Client<Schema>,
  options?: Parameters<Client<Schema>["models"]["UserProfile"]["list"]>[0]
): Promise<Schema["UserProfile"]["type"][]> {
  const allProfiles: Schema["UserProfile"]["type"][] = [];
  let nextToken: string | undefined;
  
  do {
    const res = await client.models.UserProfile.list({ ...options, nextToken });
    allProfiles.push(...(res.data ?? []));
    nextToken = res.nextToken ?? undefined;
  } while (nextToken);
  
  return allProfiles;
}
