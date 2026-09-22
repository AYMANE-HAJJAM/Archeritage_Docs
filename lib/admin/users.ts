import "server-only";

import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { revokeUserSessions } from "@/lib/auth";
import { AuditActions, writeAuditLog } from "@/lib/admin/audit";
import {
  createInvitationForUser,
  sendInvitationEmail,
} from "@/lib/admin/invitations";
import {
  createUserSchema,
  updateUserSchema,
} from "@/lib/admin/schemas";

export { createUserSchema, updateUserSchema };
function displayName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

async function countActiveAdmins(excludeUserId?: string) {
  return db.user.count({
    where: {
      role: "ADMIN",
      status: { in: ["ACTIVE", "INVITED"] },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

export async function listUsers(search?: string) {
  const q = search?.trim();
  return db.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function createInvitedUser(
  input: z.infer<typeof createUserSchema>,
  actorUserId: string,
) {
  const data = createUserSchema.parse(input);
  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) throw new HttpError(409, "Un compte avec cet e-mail existe déjà.");

  const user = await db.user.create({
    data: {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      name: displayName(data.firstName, data.lastName),
      role: data.role,
      status: "INVITED",
      passwordHash: null,
    },
  });

  const invite = await createInvitationForUser(user.id, actorUserId);
  const mail = await sendInvitationEmail({
    to: user.email,
    inviteUrl: invite.inviteUrl,
    firstName: user.firstName,
  });

  await writeAuditLog({
    actorUserId,
    action: AuditActions.USER_CREATED,
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, role: user.role },
  });

  return {
    user,
    inviteUrl: invite.inviteUrl,
    expiresAt: invite.expiresAt,
    emailSent: mail.sent,
    emailFailureReason: mail.sent
      ? undefined
      : mail.reason === "send_failed"
        ? ("send_failed" as const)
        : ("email_not_configured" as const),
  };
}

export async function updateUserAccount(
  userId: string,
  input: z.infer<typeof updateUserSchema>,
  actorUserId: string,
) {
  const data = updateUserSchema.parse(input);
  const current = await db.user.findUnique({ where: { id: userId } });
  if (!current) throw new HttpError(404, "Utilisateur introuvable.");

  if (current.email !== data.email) {
    const clash = await db.user.findUnique({ where: { email: data.email } });
    if (clash) throw new HttpError(409, "Un compte avec cet e-mail existe déjà.");
  }

  if (
    current.role === "ADMIN" &&
    data.role === "USER" &&
    (current.status === "ACTIVE" || current.status === "INVITED")
  ) {
    const remaining = await countActiveAdmins(userId);
    if (remaining < 1) {
      throw new HttpError(
        400,
        "Impossible de retirer le dernier administrateur actif.",
      );
    }
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      name: displayName(data.firstName, data.lastName),
      email: data.email,
      role: data.role,
    },
  });

  if (current.role !== data.role) {
    await writeAuditLog({
      actorUserId,
      action: AuditActions.USER_ROLE_CHANGED,
      entityType: "User",
      entityId: userId,
      metadata: { from: current.role, to: data.role },
    });
  } else {
    await writeAuditLog({
      actorUserId,
      action: AuditActions.USER_UPDATED,
      entityType: "User",
      entityId: userId,
    });
  }

  return updated;
}

export async function setUserDisabled(
  userId: string,
  disabled: boolean,
  actorUserId: string,
) {
  const current = await db.user.findUnique({ where: { id: userId } });
  if (!current) throw new HttpError(404, "Utilisateur introuvable.");

  if (disabled) {
    if (current.role === "ADMIN" && current.status !== "DISABLED") {
      const remaining = await countActiveAdmins(userId);
      if (remaining < 1) {
        throw new HttpError(
          400,
          "Impossible de désactiver le dernier administrateur actif.",
        );
      }
    }
    if (userId === actorUserId) {
      const remaining = await countActiveAdmins(userId);
      if (remaining < 1) {
        throw new HttpError(400, "Impossible de désactiver votre propre compte administrateur.");
      }
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: { status: "DISABLED" },
    });
    await revokeUserSessions(userId);
    await writeAuditLog({
      actorUserId,
      action: AuditActions.USER_DISABLED,
      entityType: "User",
      entityId: userId,
    });
    return updated;
  }

  const nextStatus =
    current.status === "DISABLED" && !current.passwordHash
      ? ("INVITED" as const)
      : ("ACTIVE" as const);
  const updated = await db.user.update({
    where: { id: userId },
    data: { status: nextStatus },
  });
  await writeAuditLog({
    actorUserId,
    action: AuditActions.USER_ACTIVATED,
    entityType: "User",
    entityId: userId,
    metadata: { via: "admin_enable" },
  });
  return updated;
}

export async function resendUserInvitation(userId: string, actorUserId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "Utilisateur introuvable.");
  if (user.status === "DISABLED") {
    throw new HttpError(400, "Réactivez le compte avant d’envoyer une invitation.");
  }
  if (user.status === "ACTIVE" && user.passwordHash) {
    throw new HttpError(400, "Ce compte est déjà activé.");
  }

  await db.user.update({
    where: { id: userId },
    data: { status: "INVITED", passwordHash: null },
  });

  const invite = await createInvitationForUser(userId, actorUserId);
  const mail = await sendInvitationEmail({
    to: user.email,
    inviteUrl: invite.inviteUrl,
    firstName: user.firstName,
  });
  return {
    ...invite,
    emailSent: mail.sent,
    emailFailureReason: mail.sent
      ? undefined
      : mail.reason === "send_failed"
        ? ("send_failed" as const)
        : ("email_not_configured" as const),
    userEmail: user.email,
  };
}
