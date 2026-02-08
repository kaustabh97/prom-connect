import { defineFunction } from "@aws-amplify/backend";

export const computeDiscoveryScores = defineFunction({
  name: "compute-discovery-scores",
  entry: "./handler.ts",
  timeoutSeconds: 120,
});
