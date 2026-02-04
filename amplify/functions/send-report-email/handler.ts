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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[sendReportEmail] RESEND_API_KEY not set");
    throw new Error("Email service not configured. Add RESEND_API_KEY to the Lambda environment.");
  }

  const subject = "Prom Connect – Report";
  const reportedLine =
    personName || personId
      ? `Reported person: ${personName || "Unknown"}${personId ? ` (ID: ${personId})` : ""}`
      : "";
  const reporterLine =
    reporterEmail || reporterName
      ? `Reporter: ${reporterName || ""} ${reporterEmail ? `<${reporterEmail}>` : ""}`.trim()
      : "";
  const text = [
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

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "Prom Connect <onboarding@resend.dev>",
        to: [REPORT_TO_EMAIL],
        subject,
        text,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[sendReportEmail] Resend API error:", res.status, errBody);
      throw new Error(`Failed to send report email: ${res.status}`);
    }
    return { success: true };
  } catch (err) {
    console.error("[sendReportEmail] Error:", err);
    throw new Error("Failed to send report email");
  }
};
