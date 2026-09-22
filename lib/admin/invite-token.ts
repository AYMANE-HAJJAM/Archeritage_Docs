import { createHash } from "node:crypto";

export function hashInvitationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function buildInvitationUrl(rawToken: string): string {
  const base = process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return `${base}/activate?token=${encodeURIComponent(rawToken)}`;
}
