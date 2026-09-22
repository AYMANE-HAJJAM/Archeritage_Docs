import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Bump when Prisma schema fields change so a long-lived `npm run dev`
 * process does not keep a stale client after `prisma generate`.
 */
const PRISMA_CLIENT_REV = "20260922-canDownload";

const globalDb = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaRev?: string;
};

if (globalDb.prisma && globalDb.prismaRev !== PRISMA_CLIENT_REV) {
  void globalDb.prisma.$disconnect().catch(() => undefined);
  globalDb.prisma = undefined;
}

export const db =
  globalDb.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 5000,
    }),
  });

if (process.env.NODE_ENV !== "production") {
  globalDb.prisma = db;
  globalDb.prismaRev = PRISMA_CLIENT_REV;
}
