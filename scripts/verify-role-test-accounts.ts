/**
 * Verify role-test accounts: password login eligibility + platform nav + /admin gate.
 */
import "dotenv/config";
import { createHmac, randomBytes } from "node:crypto";
import { compare } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const base = process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
const secret = process.env.AUTH_SECRET!;
const TEMP_PASSWORD = "TestLocal-Archeritage-2026!";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function sessionHash(token: string) {
  return createHmac("sha256", secret).update(token).digest("hex");
}

async function verifyLoginEligibility(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return { ok: false, reason: "missing" };
  if (user.status !== "ACTIVE") return { ok: false, reason: `status=${user.status}` };
  if (!user.passwordHash) return { ok: false, reason: "no_password" };
  const valid = await compare(TEMP_PASSWORD, user.passwordHash);
  if (!valid) return { ok: false, reason: "bad_password" };
  return {
    ok: true,
    role: user.role,
    status: user.status,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

async function mintCookie(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Missing ${email}`);
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      id: sessionHash(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    },
  });
  return `archeritage_session=${token}`;
}

async function getHtml(path: string, cookie: string) {
  const res = await fetch(`${base}${path}`, {
    headers: { cookie },
    redirect: "manual",
  });
  return { status: res.status, body: await res.text() };
}

function hasAdminNav(html: string) {
  return /href="\/admin"/.test(html) && />Administration</.test(html);
}

function hasAdminData(html: string) {
  return (
    html.includes("Utilisateurs actifs") ||
    html.includes("Créer un compte") ||
    (html.includes("Retour à Safi Patrimoine") && html.includes("Vue d’ensemble"))
  );
}

async function main() {
  const adminEmail = "admin.test@archeritage.local";
  const userEmail = "user.test@archeritage.local";

  const adminLogin = await verifyLoginEligibility(adminEmail);
  const userLogin = await verifyLoginEligibility(userEmail);

  const adminCookie = await mintCookie(adminEmail);
  const userCookie = await mintCookie(userEmail);

  const adminLanding = await getHtml("/projects", adminCookie);
  const userLanding = await getHtml("/projects", userCookie);
  const adminAdmin = await getHtml("/admin", adminCookie);
  const userAdmin = await getHtml("/admin", userCookie);

  const report = {
    admin: {
      email: adminEmail,
      loginEligible: adminLogin,
      landsOnPlatform: adminLanding.status === 200 && adminLanding.body.includes("Safi Patrimoine"),
      seesAdministration: hasAdminNav(adminLanding.body),
      canOpenAdmin: hasAdminData(adminAdmin.body),
    },
    user: {
      email: userEmail,
      loginEligible: userLogin,
      landsOnPlatform: userLanding.status === 200 && userLanding.body.includes("Safi Patrimoine"),
      seesAdministration: hasAdminNav(userLanding.body),
      adminAccessRejected: !hasAdminData(userAdmin.body),
    },
  };

  console.log(JSON.stringify(report, null, 2));

  if (!adminLogin.ok || !userLogin.ok) throw new Error("Login eligibility failed");
  if (!report.admin.landsOnPlatform || !report.admin.seesAdministration || !report.admin.canOpenAdmin) {
    throw new Error("ADMIN platform checks failed");
  }
  if (!report.user.landsOnPlatform || report.user.seesAdministration || !report.user.adminAccessRejected) {
    throw new Error("USER platform checks failed");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
