# ARCHERITAGE Docs — Design System Master

> Curated from UI UX Pro Max (Minimalism & Swiss + architectural editorial)  
> Adapted for SAFI PATRIMOINE institutional DMS — not a marketing site.

## Direction

**ARCHITECTURAL EDITORIAL + PROFESSIONAL DMS**

- Premium, calm, precise, information-dense
- Warm limestone canvas, charcoal type, restrained terracotta accent
- Swiss grid discipline for tables/forms
- Serif display only for module titles — never for dense operational UI

## Style

Minimalism & Swiss Style · Density 9 · Motion 2 · Variance 3

## Colors

| Token | Hex | Role |
|-------|-----|------|
| `--background` | `#F6F3EC` | Limestone page |
| `--surface` | `#FFFEFA` | Panels / tables |
| `--foreground` | `#1C1B19` | Graphite text |
| `--muted` | `#EBE6DC` | Subtle fills |
| `--muted-foreground` | `#6A655C` | Secondary text |
| `--border` | `#DDD6C8` | Warm hairline |
| `--primary` | `#2A2926` | Primary actions / ink |
| `--accent` | `#9C4A2F` | ARCHERITAGE terracotta (restrained) |
| `--ring` | `#9C4A2F` | Focus |
| `--destructive` | `#A7352B` | Danger |
| `--success` | `#3F6B4A` | Success |

## Typography

- **Display / module titles:** Source Serif 4 (`.archive-title`)
- **UI / tables / forms:** Source Sans 3
- No oversized headings; table text ~13px

## Effects

- Hover 150–200ms
- Soft warm shadow only on intentional elevation
- No glassmorphism, neon, purple gradients, giant tiles
- Respect `prefers-reduced-motion`

## Anti-patterns

- Startup SaaS dashboard look
- Playful rounded card clusters
- Destination selectors on contextual upload
- Generic Inter/Roboto/system-only without purpose

## Skill review notes (2026-09-18)

UI UX Pro Max `--design-system` suggested portfolio / exaggerated minimalism
(Cinzel + oversized type). **Rejected** for this product — wrong pattern for an
institutional DMS. Kept Swiss + architectural editorial density instead.

Applied from skill checklist:
- Lucide icons (no emoji)
- cursor-pointer on interactive controls
- 150ms hover transitions
- visible `focus-visible` rings + `scroll-padding-top` for sticky header
- `prefers-reduced-motion`
- `overflow-x-auto` on dense tables
- No left nav rail (module IA is clearer as numbered tiles + breadcrumbs)
