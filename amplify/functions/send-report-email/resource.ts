import { defineFunction } from "@aws-amplify/backend";

export const sendReportEmail = defineFunction({
  name: "send-report-email",
  entry: "./handler.ts",
  timeoutSeconds: 10,
});
