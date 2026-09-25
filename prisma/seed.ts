import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

/**
 * Seeds the administrator account only.
 *
 * Territoires, projects, parts, groups, sections and folders are created from
 * the application (Projets / Structure), never from the seed.
 */
async function main() {
  const developmentPassword = "ChangeMe-Local-Only!2026";
  const password = process.env.SEED_ADMIN_PASSWORD || developmentPassword;
  if (process.env.NODE_ENV === "production" && (password === developmentPassword || !process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_NAME)) {
    throw new Error("Set unique SEED_ADMIN_EMAIL, SEED_ADMIN_NAME and SEED_ADMIN_PASSWORD in production.");
  }
  if (password.length < 6 || password.length > 72) {
    throw new Error("Seed password must be 6–72 characters.");
  }

  const email = (process.env.SEED_ADMIN_EMAIL || "admin@archeritage.local").toLowerCase();
  const admin = await db.user.upsert({
    where: { email },
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
      email,
      passwordHash: await hash(password, 12),
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log(`Seed complete: administrator ${admin.email}. No business content created.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
