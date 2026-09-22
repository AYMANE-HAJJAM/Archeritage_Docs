/**
 * Shared document-scope types.
 *
 * Prisma still defines TERRITORY / SHARED_RESOURCE (legacy enum values kept
 * to avoid a destructive migration). Active product runtime only uses
 * PROJECT_SECTION for heritage rubriques; project-level admin docs use null.
 */
import type { DocumentScope as PrismaDocumentScope } from "@/generated/prisma/client";

export type DocumentScopeValue = PrismaDocumentScope;

/** Scopes accepted by upload / validation today. */
export const ACTIVE_DOCUMENT_SCOPES = ["PROJECT_SECTION"] as const;

export type ActiveDocumentScope = (typeof ACTIVE_DOCUMENT_SCOPES)[number];

export function isActiveDocumentScope(
  value: string,
): value is ActiveDocumentScope {
  return (ACTIVE_DOCUMENT_SCOPES as readonly string[]).includes(value);
}

/** @deprecated Prefer isActiveDocumentScope — legacy enum values remain in Prisma. */
export function isDocumentScopeValue(value: string): value is DocumentScopeValue {
  return (
    value === "PROJECT_SECTION" ||
    value === "TERRITORY" ||
    value === "SHARED_RESOURCE"
  );
}
