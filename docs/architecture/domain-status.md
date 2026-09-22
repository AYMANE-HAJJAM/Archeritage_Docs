# Domain model implementation status

Prisma models in `prisma/schema.prisma` include the full SAFI CDC heritage graph. **Do not remove unused models** — they are planned domain capacity.

| Model | Runtime status |
|-------|----------------|
| User, Session, LoginAttempt | Wired (auth); `AccountStatus` INVITED/ACTIVE/DISABLED |
| InvitationToken | Wired (admin invite → `/activate`) |
| AuditLog | Wired (admin mutations) |
| Territoire, Project | Wired; `Project.isActive` archive flag |
| Folder, File | Wired (DMS + scopes) |
| HeritageSectionGroup, HeritageSection | Wired — **runtime heritage IA** |
| Sequence | Read in heritage section summaries / structured panels |
| Observation, Investigation, Decision, Intervention | Read when section `tracks` include them |
| Secteur | Schema only — not queried in app yet |
| Element | Schema only |
| Gate | Schema only |
| Preuve | Schema only |
| ProjectMember / ProjectRole | Schema only — **Phase 2B** fine-grained project authz |
| Confidentialite on File | Written; USER blocked from `CONFIDENTIEL` reads; ADMIN allowed |

## Application roles (wired)

- `User.role`: `ADMIN` | `USER`
- Admin surface: `/admin/**` via `requireAdmin()`
- Daily document work does **not** require ADMIN

## Document scopes (wired)

- `PROJECT_SECTION` — `docCategorie` = section code (`01.3`, `02.12`)
- *(null)* — project-level administrative document

Legacy Prisma values `TERRITORY` / `SHARED_RESOURCE` exist in the enum but are unused after the 00/03 product removal.

## Heritage structure SoT

| Layer | Role |
|-------|------|
| `HeritageSection` (+ groups) in DB | Runtime titles, order, active flag |
| `lib/heritage/config/structure.ts` | Seed / bootstrap templates only |
| `lib/heritage/queries/structure.ts` | Loaders for user + admin UI |
