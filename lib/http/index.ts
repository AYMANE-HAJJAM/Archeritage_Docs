import "server-only";
import { getUser } from "@/lib/auth";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function authenticate(request: Request, mutation = false) {
  if (mutation) {
    const expected = process.env.APP_URL;
    if (!expected || request.headers.get("origin") !== new URL(expected).origin) throw new HttpError(403, "Origine de la requête non autorisée.");
  }
  const user = await getUser();
  if (!user) throw new HttpError(401, "Votre session a expiré. Veuillez vous reconnecter.");
  return user;
}
export function apiError(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return Response.json({ error: "Les informations saisies ne sont pas valides." }, { status: 400 });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") return Response.json({ error: "Ce dossier contient encore des éléments ou n’existe plus." }, { status: 409 });
    if (error.code === "P2025") return Response.json({ error: "Cet élément n’existe plus." }, { status: 404 });
    if (error.code === "P2002") return Response.json({ error: "Un élément de ce nom existe déjà." }, { status: 409 });
  }
  console.error("Operation failed", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ error: "L’opération a échoué. Veuillez réessayer." }, { status: 500 });
}
export async function readJson(request: Request) {
  const body = await readLimitedBody(request, 16 * 1024);
  try { return JSON.parse(body.toString("utf8")); } catch { throw new HttpError(400, "Requête invalide."); }
}
export async function readLimitedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length") || 0) > limit) throw new HttpError(413, "Le fichier dépasse la taille autorisée.");
  if (!request.body) throw new HttpError(400, "Requête vide.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new HttpError(413, "Le fichier dépasse la taille autorisée."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
