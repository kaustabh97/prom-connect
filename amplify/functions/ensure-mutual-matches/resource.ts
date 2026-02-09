import { defineFunction } from "@aws-amplify/backend";

export const ensureMutualMatches = defineFunction({
  name: "ensure-mutual-matches",
  entry: "./handler.ts",
  timeoutSeconds: 120,
});

