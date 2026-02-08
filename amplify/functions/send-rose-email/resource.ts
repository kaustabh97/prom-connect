import { defineFunction } from "@aws-amplify/backend";

export const sendRoseEmail = defineFunction({
  name: "send-rose-email",
  entry: "./handler.ts",
  timeoutSeconds: 10,
});
