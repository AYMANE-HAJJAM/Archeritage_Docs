import "server-only";

import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { validateDocumentCategory } from "@/lib/heritage/config/validate-category";
import {
  findHeritageSectionId,
  resolveDocumentaryUploadFolder,
  IMPORT_FOLDER_NAME,
} from "@/lib/heritage/documentary-folders";
import {
  isActiveDocumentScope,
  type ActiveDocumentScope,
} from "@/lib/heritage/types/document-scope";

export type ResolvedUploadContext = {
  projectId: string;
  /** Documentary folder id, or null when uploading at section root. */
  folderId: string | null;
  documentScope: ActiveDocumentScope;
  docCategorie: string;
  confidentialite: "PROJET" | "CONFIDENTIEL";
};

/** Technical inbox folder — not part of the heritage IA or documentary trees. */
export async function ensureImportFolder(projectId: string): Promise<string> {
  const existing = await db.folder.findFirst({
    where: { projectId, name: IMPORT_FOLDER_NAME, parentId: null },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.folder.create({
    data: {
      name: IMPORT_FOLDER_NAME,
      projectId,
      parentId: null,
      heritageSectionId: null,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Validate contextual upload metadata and resolve destination folder.
 * - Section root → folderId null (document stays at rubrique root)
 * - Inside documentary folder → that folderId (must belong to the section)
 */
export async function resolveUploadContext(input: {
  documentScope: string;
  docCategorie: string;
  projectId?: string;
  territoireCode?: string;
  folderId?: string | null;
}): Promise<ResolvedUploadContext> {
  if (!isActiveDocumentScope(input.documentScope)) {
    throw new HttpError(400, "Périmètre documentaire invalide.");
  }
  const category = input.docCategorie.trim();
  if (!category) throw new HttpError(400, "Catégorie documentaire manquante.");

  if (!input.projectId) throw new HttpError(400, "Projet manquant.");
  const project = await db.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, slug: true, isActive: true },
  });
  if (!project) throw new HttpError(404, "Projet introuvable.");
  if (!project.isActive) throw new HttpError(403, "Ce projet n’est pas accessible.");

  const validated = await validateDocumentCategory(
    input.documentScope,
    category,
    project.slug,
  );
  if (!validated.ok) throw new HttpError(400, validated.reason);

  const heritageSectionId = await findHeritageSectionId(project.id, category);
  if (!heritageSectionId) {
    throw new HttpError(400, "Rubrique patrimoniale introuvable.");
  }

  const folderId = await resolveDocumentaryUploadFolder({
    projectId: project.id,
    heritageSectionId,
    folderId: input.folderId,
  });

  return {
    projectId: project.id,
    folderId,
    documentScope: "PROJECT_SECTION",
    docCategorie: category,
    confidentialite: "PROJET",
  };
}
