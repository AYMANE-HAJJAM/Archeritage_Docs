import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { folderTrail, normalizeSearchText } from "@/lib/utils";
import { maxUploadBytes } from "@/lib/validation/file";

export type Query = { q?: string; type?: string; page?: string; folder?: string };
export async function getLibrary(slug: string, folderId: string | null, query: Query) {
  await requireUser();
  const project = await db.project.findUnique({ where: { slug }, select: { id: true, name: true, slug: true } });
  if (!project) notFound();
  const [allFoldersRaw, folderFileCounts] = await Promise.all([
    db.folder.findMany({ where: { projectId: project.id }, select: { id: true, name: true, parentId: true }, orderBy: { name: "asc" } }),
    db.file.groupBy({ by: ["folderId"], where: { projectId: project.id }, _count: true }),
  ]);
  // Technical inbox used by contextual SAFI uploads — keep internal, hide from Explorer IA.
  const allFolders = allFoldersRaw.filter((folder) => folder.name !== "__imports__");
  const current = folderId ? allFoldersRaw.find((f) => f.id === folderId) : null;
  if (folderId && !current) notFound();
  if (current?.name === "__imports__") notFound();
  const childrenByParent = new Map<string, typeof allFolders>();
  for (const folder of allFolders) {
    const children = childrenByParent.get(folder.parentId ?? "") ?? [];
    children.push(folder);
    childrenByParent.set(folder.parentId ?? "", children);
  }
  const directFileCounts = new Map(folderFileCounts.map((row) => [row.folderId, row._count]));
  const contentCounts = new Map<string, { documents: number; subfolders: number }>();
  function folderContent(folder: (typeof allFolders)[number]): { documents: number; subfolders: number } {
    const cached = contentCounts.get(folder.id);
    if (cached) return cached;
    const children = childrenByParent.get(folder.id) ?? [];
    const content = children.reduce((total, child) => {
      const childContent = folderContent(child);
      return { documents: total.documents + childContent.documents, subfolders: total.subfolders + 1 };
    }, { documents: directFileCounts.get(folder.id) ?? 0, subfolders: 0 });
    contentCounts.set(folder.id, content);
    return content;
  }
  for (const folder of allFolders) folderContent(folder);
  const q = (query.q || "").trim().slice(0, 180);
  const searchQuery = normalizeSearchText(q);
  const searching = searchQuery.length > 0;
  const filter = query.type === "images" || query.type === "documents" ? query.type : "all";
  const requestedPage = Math.max(1, Math.min(100000, Number.parseInt(query.page || "1", 10) || 1));
  const fileWhere = { projectId: project.id, folderId: folderId ?? "__root_no_files__", ...(filter !== "all" ? { storageProvider: filter === "images" ? "CLOUDINARY" as const : "BACKBLAZE_B2" as const } : {}) };
  const grouped = searching ? null : await db.file.groupBy({ by: ["storageProvider"], where: fileWhere, _count: true });
  const projectGrouped = await db.file.groupBy({ by: ["storageProvider"], where: { projectId: project.id }, _count: true });
  const candidateFiles = await db.file.findMany({ where: fileWhere, orderBy: [{ displayName: "asc" }, { id: "asc" }], ...(searching ? {} : { take: 60, skip: (Math.max(0, requestedPage - 1)) * 60 }), select: { id: true, displayName: true, originalName: true, extension: true, mimeType: true, size: true, storageProvider: true, folderId: true, createdAt: true } });
  const matchedFiles = searching ? candidateFiles.filter((file) => normalizeSearchText(`${file.displayName} ${file.originalName}`).includes(searchQuery)) : candidateFiles;
  const images = searching ? matchedFiles.filter((file) => file.storageProvider === "CLOUDINARY").length : grouped?.find((r) => r.storageProvider === "CLOUDINARY")?._count ?? 0;
  const documents = searching ? matchedFiles.filter((file) => file.storageProvider === "BACKBLAZE_B2").length : grouped?.find((r) => r.storageProvider === "BACKBLAZE_B2")?._count ?? 0;
  const count = filter === "all" ? images + documents : filter === "images" ? images : documents;
  const pages = Math.max(1, Math.ceil(count / 60));
  const page = Math.min(requestedPage, pages);
  const files = searching ? matchedFiles.slice((page - 1) * 60, page * 60) : candidateFiles;
  const folders = filter === "all" ? allFolders.filter((f) => f.parentId === folderId && (!searching || normalizeSearchText(f.name).includes(searchQuery))).map((folder) => ({ ...folder, ...contentCounts.get(folder.id)!, location: folderTrail(folder.parentId, allFolders).map((part) => part.name.replace(/^\d+\s+—\s+/, "")).join(" › ") || project.name })) : [];
  const projectImages = projectGrouped.find((row) => row.storageProvider === "CLOUDINARY")?._count ?? 0;
  const projectDocuments = projectGrouped.find((row) => row.storageProvider === "BACKBLAZE_B2")?._count ?? 0;
  return { project, current: current ?? null, allFolders, folders, files: files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString(), location: folderTrail(f.folderId, allFolders).map((part) => part.name.replace(/^\d+\s+—\s+/, "")).join(" › ") })), trail: folderTrail(folderId, allFolders), q, filter: filter as "all" | "images" | "documents", page, pages, counts: { all: images + documents, images, documents }, projectSummary: { rootFolders: allFolders.filter((folder) => !folder.parentId).length, documents: projectDocuments, images: projectImages }, maxBytes: maxUploadBytes() };
}
export type LibraryData = Awaited<ReturnType<typeof getLibrary>>;
