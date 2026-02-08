/**
 * Send an anonymous "rose" email via SES.
 * Max 2 roses per user (rosesSentCount on UserProfile). No sender identity in the email.
 */
type RoseEmailArgs = { currentUserId: string; toEmail: string; appUrl: string };

const MAX_ROSES_PER_USER = 2;

function buildRoseHtml(appUrl: string): string {
  const roseImg =
    "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=320&h=240&fit=crop";
  /* Night-sky vibe to match landing: deep navy, soft star dots (no twinkle), gold/cream text, rose. */
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Someone sent you a rose</title>
</head>
<body style="margin:0; padding:0; background: #0a0e17; font-family: 'Segoe UI', system-ui, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #0a0e17; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 32px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" style="max-width: 420px; width: 100%; background: linear-gradient(180deg, rgba(22,28,45,0.95) 0%, rgba(15,20,35,0.98) 100%); border-radius: 20px; border: 1px solid rgba(212,175,100,0.2); box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
          <tr>
            <td style="padding: 28px 24px 16px; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 12px; letter-spacing: 3px; color: rgba(212,175,100,0.9); text-transform: uppercase;">Starlit by the Brick</p>
              <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.4);">&#9733; &nbsp; &#9733; &nbsp; &#9733; &nbsp; &#9733; &nbsp; &#9733;</p>
              <p style="margin: 16px 0 0; font-size: 22px; font-weight: 600; color: #e8d5b5;">&#127801; You received a rose &#127801;</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 24px 24px; text-align: center;">
              <img src="${roseImg}" alt="Rose" width="240" height="180" style="width: 100%; max-width: 240px; height: auto; border-radius: 12px; object-fit: cover; border: 1px solid rgba(212,175,100,0.15);" />
              <p style="margin: 24px 0 0; font-size: 18px; color: #e8d5b5; line-height: 1.5;">
                Someone wants to go to Prom with you.
              </p>
              <p style="margin: 12px 0 0; font-size: 15px; color: rgba(232,213,181,0.85); line-height: 1.5;">
                It’s anonymous — they didn’t leave their name. Join Starlit by the Brick to find your date under the stars.
              </p>
              <p style="margin: 28px 0 0;">
                <a href="${appUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #d4af37 0%, #b8962e 100%); color: #0a0e17; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 999px; box-shadow: 0 4px 20px rgba(212,175,100,0.35);">
                  Join and find your date
                </a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px 24px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.35);">
              IIMA Prom matchmaking · You’ll never know who sent this rose unless you both match.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

export const handler = async (event: { arguments: RoseEmailArgs }) => {
  const { currentUserId, toEmail, appUrl } = event.arguments;
  if (!currentUserId?.trim() || !toEmail?.trim() || !appUrl?.trim()) {
    throw new Error("currentUserId, toEmail and appUrl are required");
  }
  const userId = currentUserId.trim();
  const to = toEmail.trim();
  const url = appUrl.trim();

  try {
    const { getAmplifyDataClientConfig } = await import("@aws-amplify/backend/function/runtime");
    const { Amplify } = await import("aws-amplify");
    const { generateClient } = await import("aws-amplify/data");
    const env = (await import("$amplify/env/send-rose-email")).env;
    const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
    Amplify.configure(resourceConfig, libraryOptions);
    type Schema = import("../../data/resource").Schema;
    const client = generateClient<Schema>();

    const { data: profile } = await client.models.UserProfile.get({ id: userId });
    if (!profile?.id) {
      throw new Error("Profile not found");
    }
    const count = (profile as { rosesSentCount?: number | null }).rosesSentCount ?? 0;
    if (count >= MAX_ROSES_PER_USER) {
      throw new Error(`You can only send up to ${MAX_ROSES_PER_USER} roses.`);
    }

    // @ts-expect-error - Package will be installed by Amplify during build
    const { SESClient, SendEmailCommand } = await import("@aws-sdk/client-ses");
    // Use same region where SES identities (From/To) are verified. Default ap-south-1 (Mumbai).
    const sesRegion = process.env.SES_REGION || process.env.AWS_REGION || "ap-south-1";
    const ses = new SESClient({ region: sesRegion });
    const from = process.env.SES_FROM_EMAIL || "cultcomm@iima.ac.in";

    const subject = "🌹 Someone wants to go to Prom with you — Starlit by the Brick";
    const htmlBody = buildRoseHtml(url);

    const command = new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: htmlBody, Charset: "UTF-8" },
          Text: {
            Data: `Someone wants to go to Prom with you. It's anonymous — join Starlit by the Brick to find your date: ${url}`,
            Charset: "UTF-8",
          },
        },
      },
    });

    await ses.send(command);

    await client.models.UserProfile.update({
      id: profile.id,
      email: profile.email,
      rosesSentCount: count + 1,
    });

    return { success: true };
  } catch (err) {
    const sesRegion = process.env.SES_REGION || process.env.AWS_REGION || "ap-south-1";
    const sesCode = err && typeof err === "object" && "name" in err ? (err as { name?: string }).name : undefined;
    const sesMessage = err instanceof Error ? err.message : String(err);
    console.error("[send-rose-email] error", { err, sesCode, sesMessage, from: process.env.SES_FROM_EMAIL || "cultcomm@iima.ac.in", to, region: sesRegion });
    if (err instanceof Error && err.message.includes("only send up to")) {
      throw err;
    }
    throw new Error(`Failed to send rose email: ${sesMessage} (SES region: ${sesRegion}. If your From/To are verified elsewhere, set SES_REGION and redeploy.)`);
  }
};
