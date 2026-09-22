import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe-Local-Only!2026";

async function main() {
  const passwordHash = await hash(password, 12);
  await db.user.upsert({
    where: { email: "admin@archeritage.local" },
    update: {
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash,
      firstName: "Admin",
      lastName: "ARCHERITAGE",
      name: "Administrateur",
    },
    create: {
      email: "admin@archeritage.local",
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash,
      firstName: "Admin",
      lastName: "ARCHERITAGE",
      name: "Administrateur",
    },
  });
  await db.user.upsert({
    where: { email: "user@archeritage.local" },
    update: {
      role: "USER",
      status: "ACTIVE",
      passwordHash,
      firstName: "Collaborateur",
      lastName: "Safi",
      name: "Collaborateur Safi",
    },
    create: {
      email: "user@archeritage.local",
      role: "USER",
      status: "ACTIVE",
      passwordHash,
      firstName: "Collaborateur",
      lastName: "Safi",
      name: "Collaborateur Safi",
    },
  });
  console.log("Reset passwords for admin@ and user@ to SEED_ADMIN_PASSWORD / default.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
