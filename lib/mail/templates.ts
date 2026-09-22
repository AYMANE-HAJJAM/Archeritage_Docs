export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export function buildInvitationEmail(input: {
  to: string;
  firstName: string;
  inviteUrl: string;
}): MailMessage {
  const name = input.firstName.trim() || "Bonjour";
  const subject = "Activer votre compte ARCHERITAGE Docs";
  const text = [
    `${name},`,
    "",
    "Vous êtes invité(e) à rejoindre ARCHERITAGE Docs.",
    "Activez votre compte et choisissez votre mot de passe :",
    input.inviteUrl,
    "",
    "Ce lien expire dans 7 jours.",
    "",
    "— ARCHERITAGE Docs",
  ].join("\n");

  const html = `
    <div style="font-family:Georgia,serif;line-height:1.5;color:#1a1a1a;max-width:520px">
      <p>${escapeHtml(name)},</p>
      <p>Vous êtes invité(e) à rejoindre <strong>ARCHERITAGE Docs</strong>.</p>
      <p style="margin:24px 0">
        <a href="${escapeAttr(input.inviteUrl)}"
           style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 20px;text-decoration:none;font-size:14px">
          Activer mon compte
        </a>
      </p>
      <p style="font-size:13px;color:#555">Ce lien expire dans 7 jours.</p>
      <p style="font-size:12px;color:#888">— ARCHERITAGE Docs</p>
    </div>
  `.trim();

  return { to: input.to, subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
