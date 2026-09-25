import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

async function cookieStore() {
  const { cookies } = await import("next/headers");
  return cookies();
}

async function redirectTo(pathname: string): Promise<never> {
  const { redirect } = await import("next/navigation");
  redirect(pathname);
  throw new Error("redirect");
}

const cookieName = "archeritage_session";

export type SessionUser = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "ADMIN" | "USER";
  status: "INVITED" | "ACTIVE" | "DISABLED";
};

function sessionHash(token: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("replace-with")) {
    throw new Error("Configure AUTH_SECRET with at least 32 random characters.");
  }
  return createHmac("sha256", secret).update(token).digest("hex");
}

const userSelect = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  status: true,
} as const;

export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookieStore()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await db.session.findUnique({
    where: { id: sessionHash(token) },
    include: { user: { select: userSelect } },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  if (session.user.status !== "ACTIVE") {
    // Disabled / invited accounts cannot keep a session.
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  return session.user;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) return redirectTo("/login");
  return user;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await db.session.create({ data: { id: sessionHash(token), userId, expiresAt } });
  (await cookieStore()).set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession() {
  const jar = await cookieStore();
  const token = jar.get(cookieName)?.value;
  if (token) await db.session.deleteMany({ where: { id: sessionHash(token) } });
  jar.delete(cookieName);
}

/** Revoke all sessions for a user (e.g. on disable). */
export async function revokeUserSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

export async function allowLogin(email: string) {
  const key = sessionHash(`login:${email}`);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "LoginAttempt" ("key", "count", "expiresAt")
    VALUES (${key}, 1, NOW() + INTERVAL '15 minutes')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "LoginAttempt"."expiresAt" < NOW() THEN 1 ELSE "LoginAttempt"."count" + 1 END,
      "expiresAt" = CASE WHEN "LoginAttempt"."expiresAt" < NOW() THEN NOW() + INTERVAL '15 minutes' ELSE "LoginAttempt"."expiresAt" END
    RETURNING "count"`;
  return rows[0].count <= 10;
}
