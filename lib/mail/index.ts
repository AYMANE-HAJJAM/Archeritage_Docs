import "server-only";

export type { MailSendResult, SmtpRuntimeConfig } from "@/lib/mail/smtp";
export type { MailMessage } from "@/lib/mail/templates";
export {
  createSmtpTransport,
  getSmtpRuntimeConfig,
  sendMail,
  smtpConfigured,
  verifySmtpConnection,
} from "@/lib/mail/smtp";
export { buildInvitationEmail } from "@/lib/mail/templates";
