# Folder vs documentScope

## Technical Folder

- Prisma `Folder` tree under a `Project`
- Holds `File.folderId` for storage organization
- Contextual uploads land in `__imports__` (hidden from Explorer)
- Explorer under `/projects/[slug]/documents` browses the project document index

## Logical heritage placement

- Active: `File.documentScope = PROJECT_SECTION` + `File.docCategorie` (section code)
- Project-level admin docs: both fields `null` → UI label **Document projet**
- Independent of folder path and of B2/Cloudinary keys
- Official codes: `lib/heritage/config/structure.ts`
- Validation: `lib/heritage/config/validate-category.ts`

Never invent section codes in UI or scripts — derive from structure.

Legacy Prisma enum values `TERRITORY` / `SHARED_RESOURCE` remain in the schema but are unused by the product runtime.
