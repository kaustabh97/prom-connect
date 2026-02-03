import { defineFunction } from "@aws-amplify/backend";

export const sendPartnerInvite = defineFunction({
  name: "send-partner-invite",
  entry: "./handler.ts",
  timeoutSeconds: 10,
});
