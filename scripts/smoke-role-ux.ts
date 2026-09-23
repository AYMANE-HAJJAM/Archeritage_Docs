/**
 * Verify left sidebar: ADMIN has Projets/Structure/Utilisateurs;
 * USER only Projets → /projects (not direct Safi); landing lists platforms.
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
  const res = await fetch(`${base}${path}`, {
    headers: { cookie },
    redirect: "manual",
  });
  return {
    status: res.status,
    body: await res.text(),
    location: res.headers.get("location"),
  };
}

async function main() {
  const adminCookie = await mint("admin.test@archeritage.local");
  const userCookie = await mint("user.test@archeritage.local");
  const adminHome = await html("/projects", adminCookie);
  const userHome = await html("/projects", userCookie);
  const adminSafi = await html("/territoires/saf", adminCookie);
  const adminDeep = await html("/territoires/saf", adminCookie);

  const report = {
    admin: {
      projetsNav:
        adminHome.body.includes('href="/projects"') &&
        adminHome.body.includes("Projets"),
      structureNav: adminHome.body.includes('href="/structure"'),
      usersNav: adminHome.body.includes('href="/users"'),
      listsSafiPlatform: adminHome.body.includes("Safi Patrimoine"),
      noChateauAsSiblingRow:
        !adminHome.body.includes("Château de Mer — Safi") &&
        !adminHome.body.includes("Murailles portugaises de Safi"),
      projetsActiveOnSafi:
        adminDeep.body.includes('aria-current="page"') &&
        adminDeep.body.includes("Projets"),
    },
    user: {
      projetsNav:
        userHome.body.includes('href="/projects"') &&
        userHome.body.includes("Projets"),
      noStructureHref: !userHome.body.includes('href="/structure"'),
      noUsersHref: !userHome.body.includes('href="/users"'),
      listsSafiOrEmpty:
        userHome.body.includes("Safi Patrimoine") ||
        userHome.body.includes("Aucun projet accessible"),
    },
    operational: {
      adminCanOpenSafi:
        adminSafi.status === 200 &&
        (adminSafi.body.includes("Safi Patrimoine") ||
          adminSafi.body.includes("SAFI")),
    },
  };

  console.log(JSON.stringify(report, null, 2));
  if (
    !report.admin.projetsNav ||
    !report.admin.structureNav ||
    !report.admin.usersNav
  ) {
    throw new Error("ADMIN sidebar incomplete");
  }
  if (!report.admin.listsSafiPlatform || !report.admin.noChateauAsSiblingRow) {
    throw new Error(
      "Projets page must list Safi platform, not Château/Murailles as top-level",
    );
  }
  if (!report.user.projetsNav || !report.user.noUsersHref) {
    throw new Error("USER must see Projets only (no management links)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
