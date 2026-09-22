/**
 * CLI: seed Château + Murailles heritage sections into DB.
 * Usage: npx tsx scripts/seed-heritage-structure.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { seedAllDefaultHeritageStructures } from "../lib/heritage/seed-structure";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

seedAllDefaultHeritageStructures(db)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
