import "server-only";

import { db } from "@/lib/db";
import {
  allocateUnique,
  allocateUniqueCode,
  generateSlug,
  proposeProjectCode,
} from "@/lib/admin/identifiers";

export async function allocateTerritoireCode(name: string, preferred?: string | null) {
  const base = preferred?.trim().toUpperCase() || proposeProjectCode(name);
  return allocateUniqueCode(base, async (candidate) => {
    const hit = await db.territoire.findUnique({
      where: { code: candidate },
      select: { id: true },
    });
    return Boolean(hit);
  });
}

export async function allocateProjectSlug(name: string, preferred?: string | null) {
  const base = preferred?.trim() || generateSlug(name);
  return allocateUnique(base, async (candidate) => {
    const hit = await db.project.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    return Boolean(hit);
  });
}

export async function allocatePartSlug(
  projectId: string,
  name: string,
  preferred?: string | null,
) {
  const base = preferred?.trim() || generateSlug(name);
  return allocateUnique(base, async (candidate) => {
    const hit = await db.part.findFirst({
      where: { projectId, slug: candidate },
      select: { id: true },
    });
    return Boolean(hit);
  });
}
