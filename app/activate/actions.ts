"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { activateInvitation } from "@/lib/admin/invitations";
import { createSession } from "@/lib/auth";
import { HttpError } from "@/lib/http";

const schema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(14).max(72),
  confirm: z.string().min(14).max(72),
});

export type ActivateState = { error?: string };

export async function activateAccountAction(
  _prev: ActivateState,
  form: FormData,
): Promise<ActivateState> {
  const parsed = schema.safeParse({
    token: form.get("token"),
    password: form.get("password"),
    confirm: form.get("confirm"),
  });
  if (!parsed.success) {
    return { error: "Mot de passe invalide (14–72 caractères)." };
  }
  if (parsed.data.password !== parsed.data.confirm) {
    return { error: "Les mots de passe ne correspondent pas." };
  }
  try {
    const userId = await activateInvitation(parsed.data.token, parsed.data.password);
    await createSession(userId);
  } catch (error) {
    return {
      error:
        error instanceof HttpError
          ? error.message
          : "Activation impossible. Réessayez ou contactez un administrateur.",
    };
  }
  redirect("/projects");
}
