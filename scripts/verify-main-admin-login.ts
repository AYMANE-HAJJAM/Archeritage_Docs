/**
 * Verify main ADMIN can authenticate with updated credentials.
 * Does not print the password or hash.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { compare } from "bcryptjs";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const EMAIL = "naciri@archeritage.ma";
const PASSWORD = process.env.ADMIN_UPDATE_PASSWORD || "naciri1230";

async function main() {
  const user = await db.user.findUnique({
    where: { email: EMAIL },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      passwordHash: true,
      _count: { select: { sessions: true } },
    },
  });

  if (!user) {
    console.error("FAIL: admin user not found");
    process.exitCode = 1;
    return;
  }

  const passwordOk = user.passwordHash
    ? await compare(PASSWORD, user.passwordHash)
    : false;

  const oldEmail = await db.user.findUnique({
    where: { email: "admin@archeritage.local" },
    select: { id: true },
  });

  console.log(
    JSON.stringify(
      {
        email: user.email,
        role: user.role,
        status: user.status,
        passwordVerifies: passwordOk,
        sessionsRemaining: user._count.sessions,
        oldEmailStillExists: Boolean(oldEmail),
        passwordIsHashed: Boolean(
          user.passwordHash && user.passwordHash.startsWith("$2"),
        ),
      },
      null,
      2,
    ),
  );

  if (
    !passwordOk ||
    user.role !== "ADMIN" ||
    user.status !== "ACTIVE" ||
    oldEmail
  ) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Verify failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
