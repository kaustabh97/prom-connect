type PartnerInviteArgs = { toEmail: string; fromName: string; appUrl: string };

export const handler = async (event: { arguments: PartnerInviteArgs }) => {
  const { toEmail, fromName, appUrl } = event.arguments;

  try {
    // @ts-expect-error - Package will be installed by Amplify during build
    const { SESClient, SendEmailCommand } = await import("@aws-sdk/client-ses");
    const ses = new SESClient({ region: process.env.AWS_REGION || "us-east-1" });

    const subject = "Your partner wants to link with you on Prom Connect!";
    const body = `
Hi there!

${fromName || "Someone"} wants to link with you as their partner on Prom Connect - the IIMA Prom matchmaking app.

Create your profile and accept their request to get matched:
${appUrl}

You'll need to sign in with your @iima.ac.in email.

See you at Prom!
The Prom Connect Team
`.trim();

    const command = new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL || "noreply@iima.ac.in",
      Destination: { ToAddresses: [toEmail] },
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
    console.error("[sendPartnerInvite] Error:", err);
    throw new Error("Failed to send invite email");
  }
};
