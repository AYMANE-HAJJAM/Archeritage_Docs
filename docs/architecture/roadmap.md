# Architecture roadmap

## Done — repository cleanup

- Clear folder layout (`lib/*` domains, `components/heritage`, `docs/*`)
- Shared `DocumentScope` types + category validation
- Heritage tests; README / docs for onboarding
- Product surface: Château + Murailles only (00/03 removed)

## Done — administration (ADMIN / USER)

- Application roles `ADMIN` | `USER` with server-side `lib/access`
- `/admin` users, projects, structure editor
- Invitation / activation (`INVITED` → `/activate` → `ACTIVE`)
- Soft-disable accounts (session revoke); last-ADMIN protection
- DB-driven `HeritageSection` / `HeritageSectionGroup` (seed from templates)
- Document reclassification (metadata only)
- Lightweight `AuditLog`
- Confidentialite: USER cannot read `CONFIDENTIEL`; ADMIN can

## Phase 2B — project membership (deferred)

Implement and call on file/folder/search handlers when product needs per-project roles:

1. Enforce `ProjectMember` + `ProjectRole` (Architecte / BET / Labo / MO / …)
2. Richer Confidentialite matrices per membership
3. Admin UX for membership

Keep schema models; do not remove them.

## Phase 3 — scale / performance

1. Paginate `getProjectDocumentsIndex`
2. Replace in-memory library search with DB `ILIKE` / `contains` + `take`
3. Bound section document lists
4. Preview conversion rate-limit or queue
5. Selective caching where safe

## Ops notes

- Apply migrations with `npm run db:migrate` — **never** `prisma migrate reset` on shared/Neon data
- After admin migration: `npm run db:seed` or `npm run db:seed-structure` to upsert Château/Murailles sections
- No B2/Cloudinary object moves for structure or reclassification changes
