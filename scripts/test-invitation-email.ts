/**
 * Prove invitation mail path (template + sendMail via lib/mail/smtp).
 *
 * Usage: npx tsx scripts/test-invitation-email.ts [recipient]
 */
import { config } from "dotenv";
config({ path: ".env" });

async function main() {
  const to = (process.argv[2] || process.env.SMTP_USER || "").trim();
  if (!to) {
    console.error("FAIL: no recipient");
    process.exit(1);
  }

  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const inviteUrl = `${appUrl}/activate?token=test-diagnostic-token-not-for-login`;

  const { buildInvitationEmail } = await import("../lib/mail/templates");
  const { getSmtpRuntimeConfig, sendMail } = await import("../lib/mail/smtp");

  const cfg = getSmtpRuntimeConfig();
  console.log("=== runtime (safe) ===");
  console.log(JSON.stringify(cfg, null, 2));

  const message = buildInvitationEmail({
    to,
    firstName: "Test",
    inviteUrl,
  });
  console.log("\n=== invitation payload ===");
  console.log("subject:", message.subject);
  console.log("to:", message.to);
  console.log("has CTA:", message.html.includes("Activer mon compte"));
  console.log("has activate link:", message.html.includes("/activate?token="));

  console.log("\n=== sendMail (invitation) ===");
  const result = await sendMail(message);
  console.log(JSON.stringify(result, null, 2));

  if (!result.sent) {
    process.exit(1);
  }
  console.log("OK: invitation email accepted by SMTP server (emailSent===true path)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
