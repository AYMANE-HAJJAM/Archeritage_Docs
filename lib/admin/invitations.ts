import "server-only";

import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { AuditActions, writeAuditLog } from "@/lib/admin/audit";
import {
  buildInvitationUrl,
  hashInvitationToken,
} from "@/lib/admin/invite-token";
import { validatePassword } from "@/lib/auth/password";

export { buildInvitationUrl, hashInvitationToken };

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export async function createInvitationForUser(
  userId: string,
  actorUserId: string | null,
): Promise<{ rawToken: string; inviteUrl: string; expiresAt: Date }> {
  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await db.invitationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  await db.invitationToken.create({
    data: {
      userId,
      tokenHash: hashInvitationToken(rawToken),
      expiresAt,
    },
  });

  if (actorUserId) {
    await writeAuditLog({
      actorUserId,
      action: AuditActions.USER_INVITE_RESENT,
      entityType: "User",
      entityId: userId,
    });
  }

  return { rawToken, inviteUrl: buildInvitationUrl(rawToken), expiresAt };
}

export async function getInvitationPreview(rawToken: string) {
  const tokenHash = hashInvitationToken(rawToken);
  const invite = await db.invitationToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          name: true,
          status: true,
        },
      },
    },
  });
  if (!invite || invite.usedAt || invite.expiresAt <= new Date()) {
    return null;
  }
  if (invite.user.status === "DISABLED") return null;
  return invite;
}

export async function activateInvitation(rawToken: string, password: string) {
  const passwordError = validatePassword(password);
  if (passwordError) {
    throw new HttpError(400, passwordError);
  }

  const tokenHash = hashInvitationToken(rawToken);
  const invite = await db.invitationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!invite || invite.usedAt || invite.expiresAt <= new Date()) {
    throw new HttpError(400, "Lien d’activation invalide ou expiré.");
  }
  if (invite.user.status === "DISABLED") {
    throw new HttpError(403, "Ce compte est désactivé.");
  }

  const passwordHash = await hash(password, 12);

  await db.$transaction([
    db.user.update({
      where: { id: invite.userId },
      data: { passwordHash, status: "ACTIVE" },
    }),
    db.invitationToken.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    }),
    db.invitationToken.updateMany({
      where: { userId: invite.userId, usedAt: null, id: { not: invite.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  await writeAuditLog({
    actorUserId: invite.userId,
    action: AuditActions.USER_ACTIVATED,
    entityType: "User",
    entityId: invite.userId,
    metadata: { via: "invitation" },
  });

  return invite.userId;
}

/** Send invitation email via MailService (SMTP when configured). */
export async function sendInvitationEmail(input: {
  to: string;
  inviteUrl: string;
  firstName: string;
}) {
  const { buildInvitationEmail, sendMail } = await import("@/lib/mail");
  return sendMail(
    buildInvitationEmail({
      to: input.to,
      firstName: input.firstName,
      inviteUrl: input.inviteUrl,
    }),
  );
}
