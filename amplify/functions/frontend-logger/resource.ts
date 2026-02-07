import { defineFunction } from "@aws-amplify/backend";

export const frontendLogger = defineFunction({
  name: "frontend-logger",
  entry: "./handler.ts",
  timeoutSeconds: 5,
});
