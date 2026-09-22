/**
 * HISTORICAL — superseded by scripts/migrate-remove-territory-shared-scopes.ts
 *
 * Original script applied TERRITORY / SHARED_RESOURCE placements.
 * Those product modules were removed; do not re-run this file as-is.
 *
 * Usage (blocked):
 *   npx tsx scripts/apply-document-placement.ts
 */
console.error(
  [
    "apply-document-placement.ts is retired.",
    "Use scripts/migrate-remove-territory-shared-scopes.ts for the post-00/03 metadata migration,",
    "or scripts/classify-heritage-documents.ts for CERTAIN heritage section codes.",
    "See docs/decisions/remove-00-03-modules.md",
  ].join("\n"),
);
process.exit(1);
