# Architecture overview — ARCHERITAGE Docs / SAFI PATRIMOINE

Private heritage documentation platform for Safi.

## Navigation model

```
Territoire (SAF)
  ├── Château de Mer   → PROJECT_SECTION (01.x)
  └── Murailles        → PROJECT_SECTION (02.x)
```

Within a project: **heritage section** (`?section=02.12`) shows documents + optional structured entities (sequences, observations, …).

## Application roles

| Role | Capabilities |
|------|----------------|
| **USER** | Projects, sections, upload, preview/download, search |
| **ADMIN** | All USER capabilities + `/admin` (users, projects, structure, reclassify) |

Invitation lifecycle: `INVITED` → activate at `/activate` → `ACTIVE`. `DISABLED` blocks login and clears sessions.

## Folder vs heritage section

| Concept | Role |
|---------|------|
| **Folder** | Technical storage relation for files (explorer / `__imports__` inbox). Not the CDC IA. |
| **Heritage section** | Logical business classification via `File.documentScope = PROJECT_SECTION` + `File.docCategorie`. Runtime definition: `HeritageSection` rows in DB. |
| **Document projet** | Project-level administrative file (`documentScope` / `docCategorie` null). |

Bootstrap templates live in `lib/heritage/config/structure.ts`. **Runtime SoT** is `lib/heritage/queries/structure.ts` (DB).

## Stack

- Next.js App Router (TypeScript), Prisma → PostgreSQL/Neon
- Images → Cloudinary (authenticated); documents → Backblaze B2
- Custom cookie sessions (`lib/auth`); API Origin check on mutations (`lib/http`)
- Preview: PDF stream or LibreOffice → PDF (`lib/storage/preview-cache`)

**Next.js version note:** this app uses Next.js 16+. Consult `node_modules/next/dist/docs/` before changing framework code. Root `AGENTS.md` / `CLAUDE.md` are maintained by `next dev`.

## Where to look

| Concern | Path |
|---------|------|
| Auth | `lib/auth/` |
| Access (ADMIN/USER) | `lib/access/` |
| Admin services / audit | `lib/admin/` |
| Admin UI | `app/(private)/admin/` |
| DB | `lib/db/` |
| Storage / preview | `lib/storage/` |
| Document library / validation | `lib/documents/`, `lib/validation/` |
| Heritage templates + queries | `lib/heritage/config/`, `lib/heritage/queries/` |
| UI | `components/heritage/`, `components/documents/` |
| API | `app/api/files`, `folders`, `projects/.../search` |

## Domain model status

See [domain-status.md](./domain-status.md).

## Roadmap

See [roadmap.md](./roadmap.md).

## Historical product change

00 Territoire & Vision and 03 Centre de ressources were removed from the product surface. See [../decisions/remove-00-03-modules.md](../decisions/remove-00-03-modules.md).
