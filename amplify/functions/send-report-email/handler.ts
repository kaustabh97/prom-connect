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
  console.log("[send-report-email] request", JSON.stringify(event));
  const { personName, personId, context, reportText, reporterEmail, reporterName } =
    event.arguments;
  console.log("[send-report-email] args", {
    personName,
    personId,
    context,
    reporterEmail,
    reporterName,
    reportTextLength: reportText?.length,
  });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[send-report-email] RESEND_API_KEY not set");
    throw new Error("Email service not configured. Add RESEND_API_KEY to the Lambda environment.");
  }

  const subject = "Starlit by the Brick – Report";
  const reportedLine =
    personName || personId
      ? `Reported person: ${personName || "Unknown"}${personId ? ` (ID: ${personId})` : ""}`
      : "";
  const reporterLine =
    reporterEmail || reporterName
      ? `Reporter: ${reporterName || ""} ${reporterEmail ? `<${reporterEmail}>` : ""}`.trim()
      : "";
  const text = [
    "A user has submitted a report via Starlit by the Brick.",
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

  const resendPayload = {
    from: "Starlit by the Brick <onboarding@resend.dev>",
    to: [REPORT_TO_EMAIL],
    subject,
    textLength: text.length,
  };
  console.log("[send-report-email] resend payload", resendPayload);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "Starlit by the Brick <onboarding@resend.dev>",
        to: [REPORT_TO_EMAIL],
        subject,
        text,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[send-report-email] Resend API error", { status: res.status, body: errBody });
      throw new Error(`Failed to send report email: ${res.status}`);
    }
    const result = { success: true };
    console.log("[send-report-email] response", JSON.stringify(result));
    return result;
  } catch (err) {
    console.error("[send-report-email] error", err, { personName, personId });
    throw new Error("Failed to send report email");
  }
};
