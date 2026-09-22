/**
 * Inspect / update the primary ADMIN account.
 * Never prints password or passwordHash.
 *
 * Usage:
 *   npx tsx scripts/update-main-admin.ts inspect
 *   npx tsx scripts/update-main-admin.ts update
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hash, compare } from "bcryptjs";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const NEW_EMAIL = "naciri@archeritage.ma";
const NEW_PASSWORD = process.env.ADMIN_UPDATE_PASSWORD || "naciri1230";

async function main() {
  const mode = process.argv[2] || "inspect";

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }

  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      firstName: true,
      lastName: true,
      name: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log("ADMIN accounts:", JSON.stringify(admins, null, 2));

  const conflict = await db.user.findUnique({
    where: { email: NEW_EMAIL },
    select: { id: true, email: true, role: true, status: true },
  });

  if (mode === "inspect") {
    console.log("targetEmailExists:", conflict);
    return;
  }

  if (mode !== "update") {
    throw new Error(`Unknown mode: ${mode}`);
  }

  const primary =
    admins.find((a) => a.status === "ACTIVE") ?? admins[0] ?? null;
  if (!primary) {
    throw new Error("No ADMIN account found to update.");
  }

  if (conflict && conflict.id !== primary.id) {
    console.error("CONFLICT: target email already belongs to another user.", {
      conflictId: conflict.id,
      conflictRole: conflict.role,
      primaryId: primary.id,
      primaryEmail: primary.email,
    });
    process.exitCode = 2;
    return;
  }

  const passwordHash = await hash(NEW_PASSWORD, 12);
  const updated = await db.user.update({
    where: { id: primary.id },
    data: {
      email: NEW_EMAIL,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
    },
  });

  const sessions = await db.session.deleteMany({ where: { userId: primary.id } });
  const verifies = await compare(NEW_PASSWORD, passwordHash);

  console.log(
    JSON.stringify(
      {
        updated: true,
        oldEmail: primary.email,
        newEmail: updated.email,
        userId: updated.id,
        role: updated.role,
        status: updated.status,
        sessionsRevoked: sessions.count,
        passwordVerifies: verifies,
        passwordStoredAsHash: true,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(
      "Script failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
