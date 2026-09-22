"use server";
import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { allowLogin, clearSession, createSession } from "@/lib/auth";

const loginSchema = z.object({ email: z.email().max(254).transform((s) => s.toLowerCase()), password: z.string().min(1).max(72) });
const dummyHash = "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
export async function login(_previous: { error: string }, form: FormData) {
  const parsed = loginSchema.safeParse({ email: String(form.get("email") || "").trim(), password: form.get("password") });
  if (!parsed.success) return { error: "Vérifiez votre adresse e-mail et votre mot de passe." };
  let stage = "rate-limit";
  try {
    if (!await allowLogin(parsed.data.email)) return { error: "Trop de tentatives. Réessayez dans 15 minutes." };
    stage = "user-lookup";
    const user = await db.user.findUnique({ where: { email: parsed.data.email } });
    stage = "password-verification";
    const valid = await compare(parsed.data.password, user?.passwordHash ?? dummyHash);
    if (!user || !user.passwordHash || !valid) {
      return { error: "Adresse e-mail ou mot de passe incorrect." };
    }
    if (user.status === "DISABLED") {
      return { error: "Ce compte est désactivé. Contactez un administrateur." };
    }
    if (user.status === "INVITED") {
      return { error: "Activez d’abord votre compte via le lien d’invitation." };
    }
    if (user.status !== "ACTIVE") {
      return { error: "Adresse e-mail ou mot de passe incorrect." };
    }
    stage = "session-creation";
    await createSession(user.id);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[auth] Login failed during ${stage}:`, error);
    } else {
      console.error(`[auth] Login failed during ${stage}.`);
    }
    return { error: "La connexion est indisponible. Veuillez réessayer plus tard." };
  }
  redirect("/projects");
}
export async function logout() { await clearSession(); redirect("/login"); }
