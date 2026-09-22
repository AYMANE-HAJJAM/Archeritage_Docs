import { requireAdmin } from "@/lib/access";
import {
  listUserProjectAccess,
  listUserTerritoireAccess,
} from "@/lib/admin/user-access";
import { listUsers } from "@/lib/admin/users";
import { UsersManagement } from "@/components/admin/users-management";
import {
  shortDossierLabel,
  type UsersTableRow,
} from "@/lib/admin/user-row";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/lib/db";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;
  const [users, platforms] = await Promise.all([
    listUsers(q),
    db.territoire.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        projects: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, code: true },
        },
      },
    }),
  ]);

  const platformPayload = platforms.map((t) => ({
    id: t.id,
    name: t.name,
    dossiers: t.projects.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
    })),
  }));

  const dossierNames = new Map(
    platforms.flatMap((t) => t.projects.map((p) => [p.id, p.name] as const)),
  );

  const rows: UsersTableRow[] = await Promise.all(
    users.map(async (user) => {
      if (user.role === "ADMIN") {
        return {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          status: user.status,
          accessLabels: [],
          projectAccess: {},
          territoireAccess: {},
        };
      }

      const [projectRows, territoireRows] = await Promise.all([
        listUserProjectAccess(user.id),
        listUserTerritoireAccess(user.id),
      ]);

      const projectAccess = Object.fromEntries(
        projectRows.map((row) => [
          row.projectId,
          {
            canView: row.canView,
            canUpload: row.canUpload,
            canDownload: row.canDownload,
            canManageStructure: row.canManageStructure,
          },
        ]),
      );

      const accessLabels = projectRows
        .filter((row) => row.canView)
        .map((row) =>
          shortDossierLabel(dossierNames.get(row.projectId) || row.projectId),
        );

      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        accessLabels,
        projectAccess,
        territoireAccess: Object.fromEntries(
          territoireRows.map((row) => [
            row.territoireId,
            { canCreateDossier: row.canCreateDossier },
          ]),
        ),
      };
    }),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Utilisateurs"
        description="Invitez des collaborateurs et définissez ce qu’ils peuvent voir, importer ou télécharger dans chaque dossier."
      />
      <UsersManagement
        users={rows}
        platforms={platformPayload}
        initialQuery={q || ""}
      />
    </div>
  );
}
