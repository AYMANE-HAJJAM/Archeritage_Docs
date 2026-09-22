# ARCHERITAGE Docs / SAFI PATRIMOINE

Private Next.js app for Safi heritage documentation: Château de Mer and Murailles portugaises.

## Product map

```
Territoire (SAF)
  → Château de Mer   (sections 01.1–01.18, DB-driven)
  → Murailles        (sections 02.1–02.20, DB-driven)
```

## Roles

| Role | Purpose |
|------|---------|
| **USER** | Daily work: browse projects, open sections, upload/preview/download/search documents |
| **ADMIN** | Platform administration: users, projects, heritage structure, document reclassification |

No public registration. Accounts are created by ADMIN via invitation (`/activate?token=…`).

`ProjectMember` / `ProjectRole` remain in the schema for a future fine-grained phase (2B). They are not enforced yet.

## Tech stack

Next.js App Router · TypeScript · Prisma · PostgreSQL (Neon) · Backblaze B2 · Cloudinary · custom cookie sessions.

## How to run

```sh
npm ci
cp .env.example .env   # fill DATABASE_URL, AUTH_SECRET, APP_URL, Cloudinary, B2
npm run db:generate && npm run db:migrate && npm run db:seed
# If structure tables are empty after migrate: npm run db:seed-structure
npm run dev            # http://localhost:3000
```

Env vars are listed in `.env.example` (never commit secrets).

## Architecture (where things live)

| Concern | Location |
|---------|----------|
| Pages (user) | `app/(private)/projects`, `territoires` |
| Management (ADMIN nav) | `/projects/manage`, `/structure`, `/users` |
| Legacy `/admin/*` | Redirects to the routes above |
| Account activation | `app/activate` |
| APIs | `app/api/files`, `folders`, `projects/.../search` |
| Auth / sessions | `lib/auth/` |
| Access control | `lib/access/` (`requireAdmin`, `assertProjectAccess`, …) |
| Admin services | `lib/admin/` (users, invitations, projects, structure, audit) |
| Database | `lib/db/` → `generated/prisma` |
| Storage / preview | `lib/storage/` |
| Document library | `lib/documents/` |
| File validation | `lib/validation/` |
| Heritage templates (seed only) | `lib/heritage/config/structure.ts` |
| Heritage runtime SoT | DB `HeritageSection` / `HeritageSectionGroup` via `lib/heritage/queries/structure.ts` |
| UI | `components/heritage`, `documents`, `layout`, `ui` |

Details: [docs/architecture/overview.md](docs/architecture/overview.md).

### Heritage structure (DB source of truth)

After migration + seed, **runtime** section titles/order/groups come from PostgreSQL.
`structure.ts` remains the bootstrap template for `db:seed` / `db:seed-structure` only — do not edit it expecting live UI changes; use **Administration → Projets → Structure**.

### DocumentScope

| Scope | `docCategorie` |
|-------|----------------|
| `PROJECT_SECTION` | section code (`01.3`, `02.12`) |
| *(null)* | project-level administrative document (“Document projet”) |

**Folder** = technical storage relation. **Heritage section** = logical IA. See [folder-vs-scope.md](docs/architecture/folder-vs-scope.md).

### Auth / upload / preview

- Auth: bcrypt login, opaque HttpOnly session (8h). Disabled / invited accounts cannot authenticate; disable revokes sessions.
- Upload: any **USER** (or ADMIN) via contextual section upload — ADMIN not required.
- Confidential documents (`CONFIDENTIEL`): USER blocked on read; ADMIN allowed. Broader ProjectMember rules are Phase 2B.
- Preview/download: authenticated streams; Office may convert via LibreOffice.

## Adding a feature

| Task | Start here |
|------|------------|
| New heritage rubrique | Admin structure editor (or seed template then `db:seed-structure`) |
| New API | `app/api/.../route.ts` + `authenticate` / `requireAdminApi` |
| New page | `app/(private)/...` |
| Admin action | `lib/admin/*` + `app/(private)/admin/**` |

## Local / generated (not authored source)

| Path | Role |
|------|------|
| `generated/` | Prisma client (`npm run db:generate`) — gitignored |
| `.next/`, `node_modules/`, `.cache/` | Build / deps / preview cache — gitignored |
| `source_import/` | Optional local import corpus for ops scripts — gitignored, not served |
| `tests/fixtures/` | Checked-in samples for tests |
