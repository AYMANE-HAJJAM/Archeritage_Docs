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

/** The five project permission flags — no roles, no reclassification. */
type ProjectFlags = {
  canView: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canDeleteDocuments?: boolean;
  canManageStructure: boolean;
};

async function upsertProjectAccess(
  userId: string,
  projectId: string,
  flags: ProjectFlags,
) {
  const data = {
    canView: flags.canView,
    canUpload: flags.canUpload,
    canDownload: flags.canDownload,
    canDeleteDocuments: flags.canDeleteDocuments ?? false,
    canManageStructure: flags.canManageStructure,
  };
  await db.projectMember.upsert({
    where: { userId_projectId: { userId, projectId } },
    create: { userId, projectId, ...data },
    update: data,
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
    // Grant the test matrix on whichever projects already exist: the first gets
    // view+upload, the second view+download only. The script never creates projects.
    const projects = await db.project.findMany({
      orderBy: { createdAt: "asc" },
      take: 2,
      select: { id: true, slug: true },
    });
    if (!projects.length) {
      console.warn("No project in database — skipping permission seed.");
    }
    const matrix: ProjectFlags[] = [
      { canView: true, canUpload: true, canDownload: true, canManageStructure: false },
      { canView: true, canUpload: false, canDownload: true, canManageStructure: false },
    ];
    for (const [index, project] of projects.entries()) {
      await upsertProjectAccess(testUser.id, project.id, matrix[index]!);
    }
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
      memberships: {
        select: {
          canView: true,
          canUpload: true,
          canDownload: true,
          canDeleteDocuments: true,
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
      projectAccess: row.memberships.map((m) => ({
        project: m.project.slug,
        canView: m.canView,
        canUpload: m.canUpload,
        canDownload: m.canDownload,
        canDeleteDocuments: m.canDeleteDocuments,
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
