/**
 * Pure identifier helpers for admin create flows.
 * Server allocates uniqueness; these propose candidates only.
 */

const WORD_RE = /[a-z0-9]+/gi;

export function tokenizeName(name: string): string[] {
  const normalized = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  return normalized.match(WORD_RE) ?? [];
}

/** URL-safe slug from a display name (accents stripped, hyphenated). */
export function generateSlug(name: string): string {
  const slug = tokenizeName(name).join("-").slice(0, 80);
  return slug || "item";
}

/**
 * Platform / top-level project code from name.
 * Essaouira Patrimoine → ESS, Safi Patrimoine → SAF
 */
export function proposeProjectCode(name: string): string {
  const stop = new Set([
    "de",
    "du",
    "des",
    "la",
    "le",
    "les",
    "et",
    "d",
    "l",
    "un",
    "une",
    "the",
    "of",
    "and",
    "patrimoine",
  ]);
  const words = tokenizeName(name).filter((w) => !stop.has(w) && w.length > 0);
  if (!words.length) return "PRJ";
  return words[0].slice(0, 3).toUpperCase().padEnd(2, "X");
}

/**
 * Dossier code from name.
 * Château de Mer → CDM, Murailles → MUR, Dar Soltane → DS
 */
export function proposeDossierCode(name: string): string {
  const words = tokenizeName(name);
  if (!words.length) return "DOS";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 4);
}

/**
 * Next section code for a dossier prefix (e.g. "01").
 * Does not renumber existing codes — uses max numeric suffix + 1.
 */
export function generateNextSectionCode(
  existingCodes: string[],
  prefix: string,
): string {
  const safePrefix = prefix.replace(/[^0-9]/g, "") || "00";
  const re = new RegExp(`^${safePrefix}\\.(\\d+)$`);
  let max = 0;
  for (const code of existingCodes) {
    const m = code.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  let next = max + 1;
  let candidate = `${safePrefix}.${next}`;
  const taken = new Set(existingCodes);
  while (taken.has(candidate)) {
    next += 1;
    candidate = `${safePrefix}.${next}`;
  }
  return candidate;
}

/** Extract dossier prefixes from section codes like "01.12" → "01". */
export function extractSectionPrefixes(codes: string[]): string[] {
  const prefixes = new Set<string>();
  for (const code of codes) {
    const m = code.match(/^(\d+)\./);
    if (m) prefixes.add(m[1]);
  }
  return [...prefixes];
}

/**
 * Allocate a unique string by appending -2, -3, … when needed.
 */
export async function allocateUnique(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
  maxAttempts = 50,
): Promise<string> {
  if (!(await isTaken(base))) return base;
  for (let n = 2; n < maxAttempts + 2; n++) {
    const suffix = `-${n}`;
    const candidate =
      base.length + suffix.length > 80
        ? `${base.slice(0, Math.max(1, 80 - suffix.length))}${suffix}`
        : `${base}${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error("Impossible d’allouer un identifiant unique.");
}

/**
 * Allocate a unique uppercase code (ESS, ESS2, ESS3…).
 */
export async function allocateUniqueCode(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
  maxAttempts = 50,
): Promise<string> {
  const root = base.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 10) || "X";
  if (!(await isTaken(root))) return root;
  for (let n = 2; n < maxAttempts + 2; n++) {
    const candidate = `${root.slice(0, Math.max(1, 10 - String(n).length))}${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error("Impossible d’allouer un code unique.");
}
