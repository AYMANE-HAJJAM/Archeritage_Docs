"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/access";
import { HttpError } from "@/lib/http";
import {
  createInvitedUser,
  createUserSchema,
  resendUserInvitation,
  setUserDisabled,
  updateUserAccount,
  updateUserSchema,
} from "@/lib/admin/users";

export type AdminActionState = {
  error?: string;
  inviteUrl?: string;
  ok?: boolean;
};

export async function createUserAction(
  _prev: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  try {
    const admin = await requireAdmin();
    const parsed = createUserSchema.safeParse({
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      email: form.get("email"),
      role: form.get("role") || "USER",
    });
    if (!parsed.success) {
      return { error: "Vérifiez les informations du compte." };
    }
    const result = await createInvitedUser(parsed.data, admin.id);
    revalidatePath("/users");
    revalidatePath("/admin/users");
    return { ok: true, inviteUrl: result.inviteUrl };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Création impossible.",
    };
  }
}

export async function updateUserAction(
  _prev: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
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
    revalidatePath("/users");
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Mise à jour impossible.",
    };
  }
}

export async function toggleUserDisabledAction(
  _prev: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  try {
    const admin = await requireAdmin();
    const userId = String(form.get("userId") || "");
    const disabled = String(form.get("disabled") || "") === "1";
    if (!userId) return { error: "Utilisateur manquant." };
    await setUserDisabled(userId, disabled, admin.id);
    revalidatePath("/users");
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Action impossible.",
    };
  }
}

export async function resendInviteAction(
  _prev: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  try {
    const admin = await requireAdmin();
    const userId = String(form.get("userId") || "");
    if (!userId) return { error: "Utilisateur manquant." };
    const invite = await resendUserInvitation(userId, admin.id);
    revalidatePath("/users");
    revalidatePath("/admin/users");
    return { ok: true, inviteUrl: invite.inviteUrl };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Invitation impossible.",
    };
  }
}
