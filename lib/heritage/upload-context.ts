import "server-only";

import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { validateDocumentCategory } from "@/lib/heritage/config/validate-category";
import {
  isActiveDocumentScope,
  type ActiveDocumentScope,
} from "@/lib/heritage/types/document-scope";

export type ResolvedUploadContext = {
  projectId: string;
  folderId: string;
  documentScope: ActiveDocumentScope;
  docCategorie: string;
  confidentialite: "PROJET" | "CONFIDENTIEL";
};

const IMPORT_FOLDER_NAME = "__imports__";

/** Technical inbox folder — not part of the heritage IA navigation. */
export async function ensureImportFolder(projectId: string): Promise<string> {
  const existing = await db.folder.findFirst({
    where: { projectId, name: IMPORT_FOLDER_NAME, parentId: null },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.folder.create({
    data: { name: IMPORT_FOLDER_NAME, projectId, parentId: null },
    select: { id: true },
  });
  return created.id;
}

/**
 * Validate contextual upload metadata and resolve project + technical folder.
 * Only PROJECT_SECTION (heritage rubrique) is accepted for contextual uploads.
 */
export async function resolveUploadContext(input: {
  documentScope: string;
  docCategorie: string;
  projectId?: string;
  territoireCode?: string;
}): Promise<ResolvedUploadContext> {
  if (!isActiveDocumentScope(input.documentScope)) {
    throw new HttpError(400, "Périmètre documentaire invalide.");
  }
  const scope = input.documentScope;
  const category = input.docCategorie.trim();
  if (!category) throw new HttpError(400, "Catégorie documentaire manquante.");

  if (!input.projectId) throw new HttpError(400, "Projet manquant.");
  const project = await db.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, slug: true, isActive: true },
  });
  if (!project) throw new HttpError(404, "Projet introuvable.");
  if (!project.isActive) throw new HttpError(403, "Ce projet n’est pas accessible.");

  const validated = await validateDocumentCategory(scope, category, project.slug);
  if (!validated.ok) throw new HttpError(400, validated.reason);

  return {
    projectId: project.id,
    folderId: await ensureImportFolder(project.id),
    documentScope: "PROJECT_SECTION",
    docCategorie: category,
    confidentialite: "PROJET",
  };
}
