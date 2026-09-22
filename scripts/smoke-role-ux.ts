/**
 * Verify left sidebar: ADMIN has Projets/Structure/Utilisateurs (no Safi nav);
 * USER only Safi; Projets page lists Territoire platforms not Château/Murailles.
 */
import "dotenv/config";
import { createHmac, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const base = process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
const secret = process.env.AUTH_SECRET!;
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function sessionHash(token: string) {
  return createHmac("sha256", secret).update(token).digest("hex");
}

async function mint(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Missing ${email}`);
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      id: sessionHash(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + 8 * 3600 * 1000),
    },
  });
  return `archeritage_session=${token}`;
}

async function html(path: string, cookie: string) {
  const res = await fetch(`${base}${path}`, { headers: { cookie }, redirect: "manual" });
  return { status: res.status, body: await res.text(), location: res.headers.get("location") };
}

async function main() {
  const adminCookie = await mint("admin.test@archeritage.local");
  const userCookie = await mint("user.test@archeritage.local");
  const adminHome = await html("/projects/manage", adminCookie);
  const userHome = await html("/territoires/saf", userCookie);
  const adminSafi = await html("/territoires/saf", adminCookie);

  const report = {
    admin: {
      projetsNav: adminHome.body.includes("/projects/manage") && adminHome.body.includes("Projets"),
      structureNav: adminHome.body.includes('href="/structure"'),
      usersNav: adminHome.body.includes('href="/users"'),
      listsSafiPlatform: adminHome.body.includes("Safi Patrimoine"),
      hasDossierLanguage:
        adminHome.body.includes("dossier") || adminHome.body.includes("Dossiers"),
      noChateauAsSiblingRow:
        !adminHome.body.includes("Château de Mer — Safi") &&
        !adminHome.body.includes("Murailles portugaises de Safi"),
    },
    user: {
      safi: userHome.body.includes("Safi Patrimoine") || userHome.body.includes("SAFI PATRIMOINE"),
      noProjetsManage: !userHome.body.includes("/projects/manage"),
      noStructureHref: !userHome.body.includes('href="/structure"'),
      noUsersHref: !userHome.body.includes('href="/users"'),
    },
    operational: {
      adminCanOpenSafi: adminSafi.status === 200 && adminSafi.body.includes("SAFI PATRIMOINE"),
    },
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.admin.projetsNav || !report.admin.structureNav || !report.admin.usersNav) {
    throw new Error("ADMIN sidebar incomplete");
  }
  if (!report.admin.listsSafiPlatform || !report.admin.noChateauAsSiblingRow) {
    throw new Error("Projets page must list Safi platform, not Château/Murailles as top-level");
  }
  if (!report.user.noProjetsManage || !report.user.noUsersHref) {
    throw new Error("USER must not see management links");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
