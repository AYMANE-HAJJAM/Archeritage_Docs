import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

import type { MailMessage } from "@/lib/mail/templates";

export type MailSendResult =
  | { sent: true; provider: string }
  | {
      sent: false;
      reason: "email_not_configured" | "send_failed";
      detail?: string;
    };

export type SmtpRuntimeConfig = {
  configured: boolean;
  host: string | null;
  port: number | null;
  secure: boolean | null;
  from: string | null;
  userSet: boolean;
  passSet: boolean;
  appUrl: string | null;
};

function trimEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value || undefined;
}

/** Safe runtime snapshot — never includes SMTP_PASS. */
export function getSmtpRuntimeConfig(): SmtpRuntimeConfig {
  const host = trimEnv("SMTP_HOST") ?? null;
  const from = trimEnv("SMTP_FROM") ?? null;
  const portRaw = trimEnv("SMTP_PORT");
  const port = portRaw ? Number(portRaw) : null;
  const secureFlag = trimEnv("SMTP_SECURE");
  const secure =
    host == null
      ? null
      : secureFlag === "1" ||
        secureFlag === "true" ||
        port === 465;

  return {
    configured: Boolean(host && from),
    host,
    port: Number.isFinite(port as number) ? (port as number) : host ? 587 : null,
    secure,
    from,
    userSet: Boolean(trimEnv("SMTP_USER")),
    passSet: Boolean(trimEnv("SMTP_PASS")),
    appUrl: trimEnv("APP_URL") ?? null,
  };
}

export function smtpConfigured(): boolean {
  return getSmtpRuntimeConfig().configured;
}

export function createSmtpTransport(): Transporter {
  const cfg = getSmtpRuntimeConfig();
  if (!cfg.configured || !cfg.host || !cfg.from || cfg.port == null) {
    throw new Error("SMTP is not configured.");
  }

  const user = trimEnv("SMTP_USER");
  const pass = trimEnv("SMTP_PASS");

  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: Boolean(cfg.secure),
    auth: user && pass ? { user, pass } : undefined,
  });
}

/** Connection check — does not send mail. */
export async function verifySmtpConnection(): Promise<
  | { ok: true }
  | { ok: false; detail: string }
> {
  if (!smtpConfigured()) {
    return { ok: false, detail: "email_not_configured" };
  }
  try {
    const transporter = createSmtpTransport();
    await transporter.verify();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "unknown",
    };
  }
}

/**
 * Platform mail delivery.
 * - If SMTP_* env vars are set → send via SMTP (nodemailer).
 * - Otherwise → no-op (ADMIN can copy the activation link locally).
 */
export async function sendMail(message: MailMessage): Promise<MailSendResult> {
  if (!smtpConfigured()) {
    return { sent: false, reason: "email_not_configured" };
  }

  try {
    const transporter = createSmtpTransport();
    await transporter.sendMail({
      from: trimEnv("SMTP_FROM"),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    return { sent: true, provider: "smtp" };
  } catch (error) {
    console.error(
      "[mail] send failed",
      error instanceof Error ? error.message : "unknown",
    );
    return {
      sent: false,
      reason: "send_failed",
      detail: error instanceof Error ? error.message : "unknown",
    };
  }
}
