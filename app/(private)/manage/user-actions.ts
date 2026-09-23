"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/access";
import { HttpError } from "@/lib/http";
import {
  applyInviteAccessMatrix,
  listUserProjectAccess,
  upsertUserProjectAccess,
} from "@/lib/admin/user-access";
import {
  accessLabelsFromMap,
  shortDossierLabel,
  type DossierFlags,
  type UsersTableRow,
} from "@/lib/admin/user-row";
import {
  createInvitedUser,
  createUserSchema,
  resendUserInvitation,
  setUserDisabled,
  updateUserAccount,
  updateUserSchema,
} from "@/lib/admin/users";
import { db } from "@/lib/db";

export type ManageUserActionState = {
  error?: string;
  inviteUrl?: string;
  emailSent?: boolean;
  emailFailureReason?: "email_not_configured" | "send_failed";
  invitedEmail?: string;
  ok?: boolean;
  /** Updated/created row for live UI (no full list refetch). */
  user?: UsersTableRow;
};

async function dossierNameMap(): Promise<Map<string, string>> {
  const projects = await db.project.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  return new Map(projects.map((p) => [p.id, p.name]));
}

async function buildUserRow(userId: string): Promise<UsersTableRow | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      status: true,
    },
  });
  if (!user) return null;

  if (user.role === "ADMIN") {
    return {
      ...user,
      accessLabels: [],
      projectAccess: {},
      territoireAccess: {},
    };
  }

  const [projectRows, names] = await Promise.all([
    listUserProjectAccess(userId),
    dossierNameMap(),
  ]);

  const projectAccess: Record<string, DossierFlags> = Object.fromEntries(
    projectRows.map((row) => [
      row.projectId,
      {
        canView: row.canView,
        canUpload: row.canUpload,
        canDownload: row.canDownload,
        canManageStructure: row.canManageStructure,
      },
    ]),
  );

  return {
    ...user,
    accessLabels: accessLabelsFromMap(user.role, projectAccess, names),
    projectAccess,
    // Schema field TerritoireMember.canCreateDossier kept unused (ADMIN-only create).
    territoireAccess: {},
  };
}

function projectAccessFromForm(form: FormData): Record<string, DossierFlags> {
  const ids = form.getAll("projectId").map(String).filter(Boolean);
  return Object.fromEntries(
    ids.map((projectId) => [
      projectId,
      {
        canView: flag(form, `canView_${projectId}`),
        canUpload: flag(form, `canUpload_${projectId}`),
        canDownload: flag(form, `canDownload_${projectId}`),
        canManageStructure: flag(form, `canManageStructure_${projectId}`),
      },
    ]),
  );
}

function labelsFromAccess(
  role: "ADMIN" | "USER",
  projectAccess: Record<string, DossierFlags>,
  names: Map<string, string>,
): string[] {
  return accessLabelsFromMap(role, projectAccess, names);
}

export async function createUserAction(
  _prev: ManageUserActionState,
  form: FormData,
): Promise<ManageUserActionState> {
  try {
    const admin = await requireAdmin();
    const parsed = createUserSchema.safeParse({
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      email: form.get("email"),
      role: "USER",
    });
    if (!parsed.success) {
      return { error: "Vérifiez les informations du compte." };
    }

    const result = await createInvitedUser(parsed.data, admin.id);
    const projectAccessList = parseProjectAccessFromForm(form);
    await applyInviteAccessMatrix(admin, result.user.id, projectAccessList);

    const names = await dossierNameMap();
    const projectAccess = projectAccessFromForm(form);
    const user: UsersTableRow = {
      id: result.user.id,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      email: result.user.email,
      role: result.user.role,
      status: result.user.status,
      accessLabels: labelsFromAccess(result.user.role, projectAccess, names),
      projectAccess,
      territoireAccess: {},
    };

    revalidatePath("/users");
    return {
      ok: true,
      inviteUrl: result.inviteUrl,
      emailSent: result.emailSent,
      emailFailureReason: result.emailFailureReason,
      invitedEmail: result.user.email,
      user,
    };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Création impossible.",
    };
  }
}

export async function updateUserAction(
  _prev: ManageUserActionState,
  form: FormData,
): Promise<ManageUserActionState> {
  try {
    const admin = await requireAdmin();
    const userId = String(form.get("userId") || "");
    const parsed = updateUserSchema.safeParse({
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      email: form.get("email"),
      role: form.get("role"),
    });
    if (!userId || !parsed.success) {
      return { error: "Vérifiez les informations du compte." };
    }
    await updateUserAccount(userId, parsed.data, admin.id);
    const user = await buildUserRow(userId);
    revalidatePath("/users");
    return { ok: true, user: user ?? undefined };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Mise à jour impossible.",
    };
  }
}

export async function toggleUserDisabledAction(
  _prev: ManageUserActionState,
  form: FormData,
): Promise<ManageUserActionState> {
  try {
    const admin = await requireAdmin();
    const userId = String(form.get("userId") || "");
    const disabled = String(form.get("disabled") || "") === "1";
    if (!userId) return { error: "Utilisateur manquant." };
    await setUserDisabled(userId, disabled, admin.id);
    const user = await buildUserRow(userId);
    revalidatePath("/users");
    return { ok: true, user: user ?? undefined };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Action impossible.",
    };
  }
}

export async function resendInviteAction(
  _prev: ManageUserActionState,
  form: FormData,
): Promise<ManageUserActionState> {
  try {
    const admin = await requireAdmin();
    const userId = String(form.get("userId") || "");
    if (!userId) return { error: "Utilisateur manquant." };
    const invite = await resendUserInvitation(userId, admin.id);
    const user = await buildUserRow(userId);
    revalidatePath("/users");
    return {
      ok: true,
      inviteUrl: invite.inviteUrl,
      emailSent: invite.emailSent,
      emailFailureReason: invite.emailFailureReason,
      invitedEmail: invite.userEmail,
      user: user ?? undefined,
    };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Invitation impossible.",
    };
  }
}

function flag(form: FormData, name: string): boolean {
  const value = form.get(name);
  return value === "1" || value === "on" || value === "true";
}

function parseProjectAccessFromForm(form: FormData) {
  const ids = form.getAll("projectId").map(String).filter(Boolean);
  return ids.map((projectId) => ({
    projectId,
    canView: flag(form, `canView_${projectId}`),
    canUpload: flag(form, `canUpload_${projectId}`),
    canDownload: flag(form, `canDownload_${projectId}`),
    canManageStructure: flag(form, `canManageStructure_${projectId}`),
  }));
}

export async function updateUserProjectAccessAction(
  _prev: ManageUserActionState,
  form: FormData,
): Promise<ManageUserActionState> {
  try {
    const admin = await requireAdmin();
    const userId = String(form.get("userId") || "");
    const projectId = String(form.get("projectId") || "");
    if (!userId || !projectId) return { error: "Utilisateur ou dossier manquant." };
    await upsertUserProjectAccess(admin, userId, {
      projectId,
      canView: flag(form, "canView"),
      canUpload: flag(form, "canUpload"),
      canDownload: flag(form, "canDownload"),
      canManageStructure: flag(form, "canManageStructure"),
    });
    const user = await buildUserRow(userId);
    revalidatePath("/users");
    return { ok: true, user: user ?? undefined };
  } catch (error) {
    return {
      error:
        error instanceof HttpError
          ? error.message
          : "Impossible de modifier les accès. Réessayez.",
    };
  }
}

export async function updateUserAccessMatrixAction(
  _prev: ManageUserActionState,
  form: FormData,
): Promise<ManageUserActionState> {
  try {
    const admin = await requireAdmin();
    const userId = String(form.get("userId") || "");
    if (!userId) return { error: "Utilisateur manquant." };

    const projectAccess = parseProjectAccessFromForm(form);
    for (const row of projectAccess) {
      await upsertUserProjectAccess(admin, userId, row);
    }
    const user = await buildUserRow(userId);
    revalidatePath("/users");
    return { ok: true, user: user ?? undefined };
  } catch (error) {
    return {
      error:
        error instanceof HttpError
          ? error.message
          : "Impossible de modifier les accès. Réessayez.",
    };
  }
}

/** Exported for tests / reuse — short label helper. */
export { shortDossierLabel };
