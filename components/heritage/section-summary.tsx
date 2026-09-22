import type { SectionDocument } from "@/lib/heritage/queries/section-documents";
import type { SectionSummary } from "@/lib/heritage/queries/section-summaries";
import type { SectionStructuredData } from "@/lib/heritage/queries/section-structured";
import type { HeritageSection } from "@/lib/heritage/config/structure";
import { formatSize } from "@/lib/utils";
import { structuredContentLabel } from "@/components/heritage/section-explorer";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "—";
  return formatSize(bytes);
}

export function SectionSummaryBar({
  section,
  sectionSummary,
}: {
  section: HeritageSection;
  sectionSummary?: SectionSummary;
}) {
  const summaryCells = [
    {
      label: "Documents",
      value: String(sectionSummary?.fileCount ?? 0),
    },
    {
      label: "Sous-dossiers",
      value: String(sectionSummary?.subfolderCount ?? 0),
    },
    {
      label: "Taille",
      value: formatBytes(sectionSummary?.totalBytes ?? 0),
    },
    {
      label: "Dernière mise à jour",
      value: formatDate(sectionSummary?.lastUpdatedAt ?? null),
    },
    {
      label: "Statut",
      value: sectionSummary?.status ?? "Vide",
    },
  ];

  if (sectionSummary?.labels.length) {
    const structured = structuredContentLabel(sectionSummary);
    if (structured !== "—") {
      summaryCells.splice(2, 0, { label: "Contenu", value: structured });
    }
  }

  return (
    <div className="border border-border bg-surface px-4 py-4 sm:px-5">
      <p className="text-[11px] font-semibold tabular-nums tracking-[0.14em] text-accent">
        {section.code}
      </p>
      <h2 className="archive-title mt-1 text-xl text-foreground sm:text-2xl">
        {section.name}
      </h2>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
        {summaryCells.map((cell) => (
          <div key={cell.label} className="flex items-center gap-1.5">
            <dt>{cell.label}</dt>
            <dd className="font-medium text-foreground">
              {cell.label === "Statut" ? (
                <span
                  className="status-pill"
                  data-tone={
                    cell.value === "Documentée" ? "documented" : "empty"
                  }
                >
                  {cell.value}
                </span>
              ) : (
                cell.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function sectionShowsStructuredTable(section: HeritageSection): boolean {
  return (
    section.tracks.includes("sequences") ||
    section.tracks.includes("tours") ||
    section.tracks.includes("portes") ||
    section.tracks.includes("bab-el-kasbah") ||
    section.tracks.includes("observations") ||
    section.tracks.includes("investigations") ||
    section.tracks.includes("decisions") ||
    section.tracks.includes("interventions")
  );
}

export type SectionPanelProps = {
  section: HeritageSection;
  sectionSummary?: SectionSummary;
  documents: SectionDocument[];
  structured: SectionStructuredData;
  projectId?: string;
};
