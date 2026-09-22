# Ops scripts

These are **not** part of the Next.js runtime. They are CLI tools for bootstrap and metadata ops.

| Script | Status | Purpose |
|--------|--------|---------|
| `import-documents.ts` | **Active** | Dry-run / execute bulk import from local `source_import/` into DB + storage. Wired as `npm run import:documents`. |
| `classify-heritage-documents.ts` | **Retained** | Apply CERTAIN rows from `lib/heritage/classification.ts` to `File.docCategorie` (metadata only). |
| `apply-document-placement.ts` | **Historical** | Original placement including removed TERRITORY / SHARED_RESOURCE scopes — superseded by `migrate-remove-territory-shared-scopes.ts`. Do not re-run against production without review. |
| `migrate-remove-territory-shared-scopes.ts` | **Retained** | One-shot migration after removing 00 / 03 product modules (metadata only). |

Removed (superseded):
- `apply-safe-classifications.ts`

Re-run only when intentionally replaying bootstrap. Prefer dry-run first. Never touches storageKey / sourceHash / blobs.
