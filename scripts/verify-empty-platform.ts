import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizeDatabaseUrl } from "../lib/db/connection-string";

const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL),
  }),
});

async function main() {
  const counts = {
    User: await db.user.count(),
    Session: await db.session.count(),
    Admin: await db.user.count({ where: { role: "ADMIN" } }),
    Project: await db.project.count(),
    Folder: await db.folder.count(),
    File: await db.file.count(),
    Part: await db.part.count(),
    Section: await db.section.count(),
    SectionGroup: await db.sectionGroup.count(),
    Territoire: await db.territoire.count(),
    ProjectMember: await db.projectMember.count(),
  };
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
