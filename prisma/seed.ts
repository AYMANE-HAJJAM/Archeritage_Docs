import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
async function main() {
  // ── 1. Admin account ──────────────────────────────────────────────────────
  const developmentPassword = "ChangeMe-Local-Only!2026";
  const password = process.env.SEED_ADMIN_PASSWORD || developmentPassword;
  if (process.env.NODE_ENV === "production" && (password === developmentPassword || !process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_NAME)) {
    throw new Error("Set unique SEED_ADMIN_EMAIL, SEED_ADMIN_NAME and SEED_ADMIN_PASSWORD in production.");
  }
  if (password.length < 14 || Buffer.byteLength(password) > 72) throw new Error("Seed password must be 14–72 bytes.");
  await db.user.upsert({
    where: { email: (process.env.SEED_ADMIN_EMAIL || "admin@archeritage.local").toLowerCase() },
    update: {
      role: "ADMIN",
      status: "ACTIVE",
      firstName: process.env.SEED_ADMIN_FIRST_NAME || "Admin",
      lastName: process.env.SEED_ADMIN_LAST_NAME || "ARCHERITAGE",
      name: process.env.SEED_ADMIN_NAME || "Administrateur",
      passwordHash: await hash(password, 12),
    },
    create: {
      name: process.env.SEED_ADMIN_NAME || "Administrateur",
      firstName: process.env.SEED_ADMIN_FIRST_NAME || "Admin",
      lastName: process.env.SEED_ADMIN_LAST_NAME || "ARCHERITAGE",
      email: (process.env.SEED_ADMIN_EMAIL || "admin@archeritage.local").toLowerCase(),
      passwordHash: await hash(password, 12),
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  // ── 2. Territoire — Safi ──────────────────────────────────────────────────
  // Phase 1: create the root territory node. Future patrimonies (Dar Soltane,
  // Dar Al Baroud…) will be added as Projects under the same Territoire.
  const territoire = await db.territoire.upsert({
    where: { code: "SAF" },
    update: {
      name: "Safi Patrimoine",
      slug: "safi-patrimoine",
      isActive: true,
    },
    create: {
      id: "territoire-safi",
      code: "SAF",
      name: "Safi Patrimoine",
      slug: "safi-patrimoine",
      isActive: true,
    },
  });

  // ── 3. Projects (existing slugs kept intact for URL compatibility) ─────────
  const projects = [
    {
      id: "project-chateau-de-mer-safi",
      name: "Château de Mer — Safi",
      slug: "chateau-de-mer-safi",
      code: "CDM",
      type: "CHATEAU" as const,
      folders: [
        ["folder-chateau-consultation", "01 — Consultation"],
        ["folder-chateau-etudes", "02 — Études et expertise"],
        ["folder-chateau-archives", "03 — Documentation et archives"],
      ],
    },
    {
      id: "project-murailles-portugaises-safi",
      name: "Murailles portugaises de Safi",
      slug: "murailles-portugaises-de-safi",
      code: "MUR",
      type: "MURAILLE" as const,
      folders: [
        ["folder-murailles-consultation", "01 — Consultation"],
        ["folder-murailles-plans", "02 — Plans et relevés"],
        ["folder-murailles-diagnostic", "03 — Diagnostic et analyses"],
        ["folder-murailles-travail", "04 — Documents de travail"],
      ],
    },
  ] as const;

  for (const item of projects) {
    // Upsert project — preserve existing id, name, slug; set new Phase 1 fields.
    const project = await db.project.upsert({
      where: { slug: item.slug },
      update: { name: item.name, code: item.code, type: item.type, territoireId: territoire.id },
      create: { id: item.id, name: item.name, slug: item.slug, code: item.code, type: item.type, territoireId: territoire.id },
    });
    // Upsert folders — existing folders with existing files are preserved.
    for (const [id, name] of item.folders) {
      await db.folder.upsert({ where: { id }, update: { name, projectId: project.id, parentId: null }, create: { id, name, projectId: project.id } });
    }
  }

  // ── 4. Legacy folder cleanup (unchanged from original seed) ──────────────
  const legacy = await db.folder.findUnique({ where: { id: "initial-cps" }, include: { _count: { select: { files: true, children: true } } } });
  if (legacy) {
    if (!legacy._count.files && !legacy._count.children) await db.folder.delete({ where: { id: legacy.id } });
    else await db.folder.update({ where: { id: legacy.id }, data: { name: "CPS — ancien classement", parentId: "folder-chateau-consultation" } });
  }

  console.log("Seed complete: administrator, Territoire SAF (Safi Patrimoine), two dossiers patrimoniaux, seven documentary folders.");
  console.log(`  Territoire: ${territoire.code} — ${territoire.name} (id: ${territoire.id})`);

  // ── 5. Heritage structure (DB SoT) ─────────────────────────────────────────
  const { seedAllDefaultHeritageStructures } = await import("../lib/heritage/seed-structure");
  await seedAllDefaultHeritageStructures(db);
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
