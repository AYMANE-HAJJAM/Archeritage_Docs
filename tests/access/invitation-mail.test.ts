import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInvitationEmail } from "../../lib/mail/templates";

test("invitation email contains activation CTA and URL", () => {
  const msg = buildInvitationEmail({
    to: "jean@example.com",
    firstName: "Jean",
    inviteUrl: "https://app.example/activate?token=abc",
  });
  assert.equal(msg.to, "jean@example.com");
  assert.match(msg.subject, /Activer/i);
  assert.match(msg.text, /https:\/\/app\.example\/activate\?token=abc/);
  assert.match(msg.html, /Activer mon compte/);
  assert.match(msg.html, /https:\/\/app\.example\/activate\?token=abc/);
  assert.ok(!msg.text.includes("password"));
  assert.ok(!msg.html.toLowerCase().includes("mot de passe :"));
});
