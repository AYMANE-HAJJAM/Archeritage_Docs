/**
 * Safe SMTP diagnostic + optional real send.
 * Never prints SMTP_PASS.
 *
 * Usage:
 *   npx tsx scripts/test-smtp.ts
 *   npx tsx scripts/test-smtp.ts --send you@example.com
 */
import { config } from "dotenv";
import nodemailer from "nodemailer";

config({ path: ".env" });

function trimEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value || undefined;
}

function runtimeSnapshot() {
  const host = trimEnv("SMTP_HOST") ?? null;
  const from = trimEnv("SMTP_FROM") ?? null;
  const portRaw = trimEnv("SMTP_PORT");
  const port = portRaw ? Number(portRaw) : host ? 587 : null;
  const secureFlag = trimEnv("SMTP_SECURE");
  const secure =
    host == null
      ? null
      : secureFlag === "1" || secureFlag === "true" || port === 465;

  return {
    configured: Boolean(host && from),
    host,
    port: Number.isFinite(port) ? port : null,
    secure,
    from,
    userSet: Boolean(trimEnv("SMTP_USER")),
    passSet: Boolean(trimEnv("SMTP_PASS")),
    appUrl: trimEnv("APP_URL") ?? null,
  };
}

async function main() {
  const snap = runtimeSnapshot();
  console.log("=== SMTP runtime config (safe) ===");
  console.log(JSON.stringify(snap, null, 2));

  if (!snap.configured || !snap.host || !snap.from || snap.port == null) {
    console.error("FAIL: SMTP not configured (need SMTP_HOST + SMTP_FROM).");
    process.exit(1);
  }

  const user = trimEnv("SMTP_USER");
  const pass = trimEnv("SMTP_PASS");
  if (!user || !pass) {
    console.error("FAIL: SMTP_USER / SMTP_PASS missing.");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: snap.host,
    port: snap.port,
    secure: Boolean(snap.secure),
    auth: { user, pass },
  });

  console.log("\n=== transporter.verify() ===");
  try {
    await transporter.verify();
    console.log("OK: SMTP connection verified");
  } catch (error) {
    console.error(
      "FAIL verify:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }

  const sendArgIndex = process.argv.indexOf("--send");
  const to =
    sendArgIndex >= 0
      ? process.argv[sendArgIndex + 1]
      : trimEnv("SMTP_USER");

  if (!to) {
    console.error("FAIL: no recipient for --send");
    process.exit(1);
  }

  console.log("\n=== sendMail test ===");
  console.log("to:", to);
  try {
    const info = await transporter.sendMail({
      from: snap.from,
      to,
      subject: "ARCHERITAGE Docs — test SMTP",
      text: [
        "Ceci est un e-mail de test SMTP ARCHERITAGE Docs.",
        `APP_URL=${snap.appUrl ?? "(unset)"}`,
        `Host=${snap.host}:${snap.port} secure=${snap.secure}`,
      ].join("\n"),
      html: `<p>Ceci est un e-mail de test SMTP <strong>ARCHERITAGE Docs</strong>.</p>
             <p>Si vous lisez ceci, la livraison fonctionne.</p>`,
    });
    console.log("OK: sendMail accepted by server");
    console.log("messageId:", info.messageId || "(none)");
    console.log("response:", info.response || "(none)");
  } catch (error) {
    console.error(
      "FAIL sendMail:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
