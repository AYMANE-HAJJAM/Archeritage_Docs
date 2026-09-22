import { z } from "zod";

/** Application-wide user password policy (activation, reset, etc.). */
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 72;

export const PASSWORD_TOO_SHORT_MESSAGE =
  "Le mot de passe doit contenir au moins 6 caractères.";

export const PASSWORD_MISMATCH_MESSAGE =
  "Les mots de passe ne correspondent pas.";

export const PASSWORD_TOO_LONG_MESSAGE =
  "Le mot de passe est trop long.";

/**
 * Validate a user-chosen password. Server remains authoritative.
 * Length is measured in Unicode code points (characters), not bytes.
 */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return PASSWORD_TOO_SHORT_MESSAGE;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return PASSWORD_TOO_LONG_MESSAGE;
  }
  return null;
}

export function validatePasswordConfirmation(
  password: string,
  confirm: string,
): string | null {
  const lengthError = validatePassword(password);
  if (lengthError) return lengthError;
  if (password !== confirm) return PASSWORD_MISMATCH_MESSAGE;
  return null;
}

/** Zod schema for a single password field. */
export const passwordFieldSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT_MESSAGE)
  .max(MAX_PASSWORD_LENGTH, PASSWORD_TOO_LONG_MESSAGE);
