/**
 * Ensure clearly named local ADMIN + USER test accounts (ACTIVE, known password).
 * Also seeds fine-grained permissions for user.test (local verification only).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hash, compare } from "bcryptjs";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Temporary local-dev password — report to operator, never store plaintext in DB. */
const TEMP_PASSWORD = "TestLocal-Archeritage-2026!";

const ACCOUNTS = [
  {
    email: "admin.test@archeritage.local",
    firstName: "Admin",
    lastName: "Test",
    name: "Admin Test",
    role: "ADMIN" as const,
  },
  {
    email: "user.test@archeritage.local",
    firstName: "User",
    lastName: "Test",
    name: "User Test",
    role: "USER" as const,
  },
] as const;

async function upsertProjectAccess(
  userId: string,
  projectSlug: string,
  flags: {
    canView: boolean;
    canUpload: boolean;
    canDownload: boolean;
    canDeleteDocuments?: boolean;
    canManageStructure: boolean;
  },
) {
  const project = await db.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true },
  });
  if (!project) {
    console.warn(`Project ${projectSlug} not found — skip access seed`);
    return;
  }
  await db.projectMember.upsert({
    where: {
      userId_projectId: { userId, projectId: project.id },
    },
    create: {
      userId,
      projectId: project.id,
      role: "CONSULTANT",
      canView: flags.canView,
      canUpload: flags.canUpload,
      canDownload: flags.canDownload,
      canDeleteDocuments: flags.canDeleteDocuments ?? false,
      canEditDossier: false,
      canManageStructure: flags.canManageStructure,
      canReclassifyDocuments: false,
    },
    update: {
      canView: flags.canView,
      canUpload: flags.canUpload,
      canDownload: flags.canDownload,
      canDeleteDocuments: flags.canDeleteDocuments ?? false,
      canEditDossier: false,
      canManageStructure: flags.canManageStructure,
      canReclassifyDocuments: false,
    },
  });
}

async function main() {
  const passwordHash = await hash(TEMP_PASSWORD, 12);

  for (const account of ACCOUNTS) {
    await db.user.upsert({
      where: { email: account.email },
      update: {
        firstName: account.firstName,
        lastName: account.lastName,
        name: account.name,
        role: account.role,
        status: "ACTIVE",
        passwordHash,
      },
      create: {
        email: account.email,
        firstName: account.firstName,
        lastName: account.lastName,
        name: account.name,
        role: account.role,
        status: "ACTIVE",
        passwordHash,
      },
    });
  }

  const testUser = await db.user.findUnique({
    where: { email: "user.test@archeritage.local" },
    select: { id: true },
  });

  if (testUser) {
    // Local test matrix — Château: view+upload; Murailles: view only.
    await upsertProjectAccess(testUser.id, "chateau-de-mer-safi", {
      canView: true,
      canUpload: true,
      canDownload: true,
      canManageStructure: false,
    });
    await upsertProjectAccess(testUser.id, "murailles-portugaises-de-safi", {
      canView: true,
      canUpload: false,
      canDownload: true,
      canManageStructure: false,
    });
  }

  const rows = await db.user.findMany({
    where: {
      email: { in: ACCOUNTS.map((a) => a.email) },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      passwordHash: true,
      projectMembers: {
        select: {
          canView: true,
          canUpload: true,
          canDownload: true,
          canManageStructure: true,
          project: { select: { slug: true } },
        },
      },
    },
    orderBy: { email: "asc" },
  });

  const report = [];
  for (const row of rows) {
    const passwordOk = row.passwordHash
      ? await compare(TEMP_PASSWORD, row.passwordHash)
      : false;
    report.push({
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role,
      status: row.status,
      passwordVerifies: passwordOk,
      projectAccess: row.projectMembers.map((m) => ({
        project: m.project.slug,
        canView: m.canView,
        canUpload: m.canUpload,
        canDownload: m.canDownload,
        canManageStructure: m.canManageStructure,
      })),
    });
  }

  console.log(
    JSON.stringify(
      {
        temporaryPassword: TEMP_PASSWORD,
        accounts: report,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
