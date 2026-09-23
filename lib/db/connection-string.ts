/**
 * Normalize Postgres URLs for node-pg.
 *
 * Neon (and many hosts) still ship `sslmode=require`. Recent `pg-connection-string`
 * warns that require/prefer/verify-ca currently alias verify-full and will change.
 * Prefer explicit verify-full so behavior stays secure and the warning is silent.
 */
export function normalizeDatabaseUrl(url: string | undefined): string | undefined {
  if (!url) return url;

  try {
    const parsed = new URL(url);
    const mode = parsed.searchParams.get("sslmode");
    if (mode === "require" || mode === "prefer" || mode === "verify-ca") {
      parsed.searchParams.set("sslmode", "verify-full");
    }
    return parsed.toString();
  } catch {
    return url
      .replace(/([?&])sslmode=require(?=&|$)/i, "$1sslmode=verify-full")
      .replace(/([?&])sslmode=prefer(?=&|$)/i, "$1sslmode=verify-full")
      .replace(/([?&])sslmode=verify-ca(?=&|$)/i, "$1sslmode=verify-full");
  }
}
