# Decision: remove 00 Territoire & Vision and 03 Centre de ressources

**Date:** 2026-09-22  
**Status:** Applied

## Product decision

Safi landing shows only:

- Château de Mer
- Murailles

Top-level modules **00 Territoire & Vision** and **03 Centre de ressources commun** are removed from the user-facing architecture. Internal heritage section codes **01.x / 02.x** are unchanged.

## Document metadata (no storage moves)

| File | From | To |
|------|------|-----|
| Documentation portuaire — Safi.pdf | TERRITORY / medina-territoire | PROJECT_SECTION / 01.10 |
| CPS (5 versions) | SHARED_RESOURCE / cps-bde-dqe | PROJECT_SECTION / 02.15 |
| Analyse comparative et recommandations.docx | SHARED_RESOURCE / cps-bde-dqe | PROJECT_SECTION / 02.13 |
| Consultation / admin packs (Château + Murailles) | SHARED_RESOURCE / consultation | project-level (`documentScope`/`docCategorie` null); confidentialité preserved |

Script: `scripts/migrate-remove-territory-shared-scopes.ts`.

## Runtime

- Routes `/territoires/[code]/vision*` and `/ressources*` removed
- Config arrays for vision topics / shared resources removed from `structure.ts`
- Upload accepts only `PROJECT_SECTION`
- Prisma enum still contains `TERRITORY` / `SHARED_RESOURCE` (no destructive migration)
