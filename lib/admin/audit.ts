import "server-only";

import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export const AuditActions = {
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_ROLE_CHANGED: "USER_ROLE_CHANGED",
  USER_DISABLED: "USER_DISABLED",
  USER_ACTIVATED: "USER_ACTIVATED",
  USER_INVITE_RESENT: "USER_INVITE_RESENT",
  PROJECT_CREATED: "PROJECT_CREATED",
  PROJECT_UPDATED: "PROJECT_UPDATED",
  PROJECT_ARCHIVED: "PROJECT_ARCHIVED",
  TERRITOIRE_CREATED: "TERRITOIRE_CREATED",
  TERRITOIRE_UPDATED: "TERRITOIRE_UPDATED",
  TERRITOIRE_ARCHIVED: "TERRITOIRE_ARCHIVED",
  SECTION_CREATED: "SECTION_CREATED",
  SECTION_UPDATED: "SECTION_UPDATED",
  SECTION_REORDERED: "SECTION_REORDERED",
  SECTION_DEACTIVATED: "SECTION_DEACTIVATED",
  SECTION_DELETED: "SECTION_DELETED",
  GROUP_CREATED: "GROUP_CREATED",
  GROUP_UPDATED: "GROUP_UPDATED",
  DOCUMENT_RECLASSIFIED: "DOCUMENT_RECLASSIFIED",
  USER_ACCESS_UPDATED: "USER_ACCESS_UPDATED",
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

export async function writeAuditLog(input: {
  actorUserId: string | null;
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  await db.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
