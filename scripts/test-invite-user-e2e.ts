/**
 * Full invite path without Next server-only imports:
 * create INVITED user + invitation token + sendInvitationEmail equivalent.
 *
 * Usage: npx tsx scripts/test-invite-user-e2e.ts
 */
import { config } from "dotenv";
import { createHash, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { buildInvitationEmail } from "../lib/mail/templates";
import { sendMail } from "../lib/mail/smtp";

config({ path: ".env" });

function hashInvitationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function buildInvitationUrl(rawToken: string): string {
  const base =
    process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return `${base}/activate?token=${encodeURIComponent(rawToken)}`;
}

async function main() {
  const deliveryTo = (process.env.SMTP_USER || "").trim();
  if (!deliveryTo) {
    console.error("FAIL: SMTP_USER missing");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  try {
    const stamp = Date.now().toString(36);
    const accountEmail = `invite-test-${stamp}@archeritage.local`;

    const admin = await db.user.findFirst({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { id: true },
    });
    if (!admin) {
      console.error("FAIL: no ACTIVE ADMIN");
      process.exit(1);
    }

    const user = await db.user.create({
      data: {
        email: accountEmail,
        firstName: "Invite",
        lastName: "Test",
        name: "Invite Test",
        role: "USER",
        status: "INVITED",
        passwordHash: null,
      },
    });

    const rawToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.invitationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashInvitationToken(rawToken),
        expiresAt,
      },
    });

    const inviteUrl = buildInvitationUrl(rawToken);
    console.log("=== invite created ===");
    console.log("userId:", user.id);
    console.log("accountEmail:", accountEmail);
    console.log("inviteUrl:", inviteUrl);
    console.log("expiresAt:", expiresAt.toISOString());

    const mail = await sendMail(
      buildInvitationEmail({
        to: deliveryTo,
        firstName: "Invite",
        inviteUrl,
      }),
    );

    console.log("\n=== sendInvitationEmail equivalent ===");
    console.log(JSON.stringify(mail, null, 2));
    console.log("emailSent ===", mail.sent);

    if (!mail.sent) process.exit(1);

    console.log("\nOK: invitation queued to", deliveryTo);
    console.log("Subject: Activer votre compte ARCHERITAGE Docs");
    console.log("CTA link uses /activate?token=...");
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
