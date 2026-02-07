type PartnerInviteArgs = { toEmail: string; fromName: string; appUrl: string };

export const handler = async (event: { arguments: PartnerInviteArgs }) => {
  console.log("[send-partner-invite] request", JSON.stringify(event));
  const { toEmail, fromName, appUrl } = event.arguments;
  console.log("[send-partner-invite] args", { toEmail, fromName, appUrl });

  try {
    // @ts-expect-error - Package will be installed by Amplify during build
    const { SESClient, SendEmailCommand } = await import("@aws-sdk/client-ses");
    const ses = new SESClient({ region: process.env.AWS_REGION || "us-east-1" });

    const subject = "Your partner wants to link with you on Starlit by the Brick!";
    const body = `
Hi there!

${fromName || "Someone"} wants to link with you as their partner on Starlit by the Brick - the IIMA Prom matchmaking app.

Create your profile and accept their request to get matched:
${appUrl}

You'll need to sign in with your @iima.ac.in email.

See you at Prom!
The Starlit by the Brick Team
`.trim();

    const source = process.env.SES_FROM_EMAIL || "noreply@iima.ac.in";
    const command = new SendEmailCommand({
      Source: source,
      Destination: { ToAddresses: [toEmail] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Text: { Data: body, Charset: "UTF-8" },
        },
      },
    });
    console.log("[send-partner-invite] ses command", { source, toEmail, subject: subject.slice(0, 50) });

    await ses.send(command);
    const result = { success: true };
    console.log("[send-partner-invite] response", JSON.stringify(result));
    return result;
  } catch (err) {
    console.error("[send-partner-invite] error", err, { toEmail });
    throw new Error("Failed to send invite email");
  }
};
