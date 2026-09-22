"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { activateInvitation } from "@/lib/admin/invitations";
import { createSession } from "@/lib/auth";
import {
  PASSWORD_MISMATCH_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
  passwordFieldSchema,
  validatePasswordConfirmation,
} from "@/lib/auth/password";
import { HttpError } from "@/lib/http";

const schema = z.object({
  token: z.string().min(32).max(128),
  password: passwordFieldSchema,
  confirm: z.string(),
});

export type ActivateState = {
  error?: string;
  fieldErrors?: {
    password?: string;
    confirm?: string;
  };
  ok?: boolean;
};

export async function activateAccountAction(
  _prev: ActivateState,
  form: FormData,
): Promise<ActivateState> {
  const password = String(form.get("password") || "");
  const confirm = String(form.get("confirm") || "");
  const token = String(form.get("token") || "");

  const confirmError = validatePasswordConfirmation(password, confirm);
  if (confirmError) {
    return {
      error: confirmError,
      fieldErrors: {
        password:
          confirmError === PASSWORD_TOO_SHORT_MESSAGE
            ? PASSWORD_TOO_SHORT_MESSAGE
            : undefined,
        confirm:
          confirmError === PASSWORD_MISMATCH_MESSAGE
            ? PASSWORD_MISMATCH_MESSAGE
            : undefined,
      },
    };
  }

  const parsed = schema.safeParse({ token, password, confirm });
  if (!parsed.success) {
    return {
      error: PASSWORD_TOO_SHORT_MESSAGE,
      fieldErrors: { password: PASSWORD_TOO_SHORT_MESSAGE },
    };
  }

  try {
    const userId = await activateInvitation(
      parsed.data.token,
      parsed.data.password,
    );
    await createSession(userId);
  } catch (error) {
    const message =
      error instanceof HttpError
        ? error.message
        : "Activation impossible. Réessayez ou contactez un administrateur.";
    // Normalize expired/invalid invitation wording for UX.
    if (
      error instanceof HttpError &&
      (error.message.includes("expiré") || error.message.includes("invalide"))
    ) {
      return {
        error:
          "Ce lien d’activation a expiré. Demandez une nouvelle invitation.",
      };
    }
    return { error: message };
  }
  redirect("/projects?activated=1");
}
