type ReportArgs = {
  personName?: string;
  personId?: string;
  context?: string;
  reportText: string;
  reporterEmail?: string;
  reporterName?: string;
};

const REPORT_TO_EMAIL = "p24kaustabh@iima.ac.in";

export const handler = async (event: { arguments: ReportArgs }) => {
  const { personName, personId, context, reportText, reporterEmail, reporterName } =
    event.arguments;

  try {
    // @ts-expect-error - Package will be installed by Amplify during build
    const { SESClient, SendEmailCommand } = await import("@aws-sdk/client-ses");
    const ses = new SESClient({ region: process.env.AWS_REGION || "us-east-1" });

    const subject = "Prom Connect – Report";
    const reportedLine =
      personName || personId
        ? `Reported person: ${personName || "Unknown"}${personId ? ` (ID: ${personId})` : ""}`
        : "";
    const reporterLine =
      reporterEmail || reporterName
        ? `Reporter: ${reporterName || ""} ${reporterEmail ? `<${reporterEmail}>` : ""}`.trim()
        : "";
    const body = [
      "A user has submitted a report via Prom Connect.",
      "",
      reportedLine,
      `Context: ${context || "Not specified"}`,
      reporterLine,
      "",
      "Report details:",
      "---",
      reportText,
      "---",
    ]
      .filter((s) => s !== "")
      .join("\n");

    const command = new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL || "noreply@iima.ac.in",
      Destination: { ToAddresses: [REPORT_TO_EMAIL] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Text: { Data: body, Charset: "UTF-8" },
        },
      },
    });

    await ses.send(command);
    return { success: true };
  } catch (err) {
    console.error("[sendReportEmail] Error:", err);
    throw new Error("Failed to send report email");
  }
};
