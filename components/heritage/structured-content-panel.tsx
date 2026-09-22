import type { SectionStructuredData } from "@/lib/heritage/queries/section-structured";
import type { HeritageSection } from "@/lib/heritage/config/structure";

function CompactEmpty({ title, message }: { title: string; message: string }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function SimpleTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h3>
      <div className="overflow-hidden border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/55 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={index}
                className="border-b border-border/80 last:border-0 transition-colors duration-150 hover:bg-muted/40"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="max-w-xs truncate px-3 py-2 text-[13px] text-foreground"
                    title={cell}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StructuredContentPanel({
  section,
  structured,
}: {
  section: HeritageSection;
  structured: SectionStructuredData;
}) {
  if (
    section.tracks.includes("sequences") ||
    section.tracks.includes("tours") ||
    section.tracks.includes("portes") ||
    section.tracks.includes("bab-el-kasbah")
  ) {
    const title = section.tracks.includes("tours")
      ? "Tours"
      : section.tracks.includes("portes")
        ? "Portes"
        : section.tracks.includes("bab-el-kasbah")
          ? "Bab El Kasbah"
          : "Séquences";

    if (structured.sequences.length === 0) {
      return (
        <CompactEmpty
          title={title}
          message="Aucun enregistrement dans cette rubrique."
        />
      );
    }

    return (
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">
          {title}
        </h3>
        <div className="overflow-hidden border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/55 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Code</th>
                <th className="px-3 py-2 font-semibold">Nom</th>
                <th className="hidden px-3 py-2 font-semibold sm:table-cell">
                  Tranche
                </th>
                <th className="hidden px-3 py-2 font-semibold md:table-cell">
                  État
                </th>
                <th className="hidden px-3 py-2 font-semibold lg:table-cell">
                  Risque
                </th>
              </tr>
            </thead>
            <tbody>
              {structured.sequences.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/80 last:border-0 transition-colors duration-150 hover:bg-muted/40"
                >
                  <td className="px-3 py-2 text-[12px] font-semibold tabular-nums text-accent">
                    {row.code}
                  </td>
                  <td className="px-3 py-2 text-[13px] font-medium">{row.name}</td>
                  <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">
                    {row.tranche ?? "—"}
                  </td>
                  <td className="hidden px-3 py-2 text-xs text-muted-foreground md:table-cell">
                    {row.etatGeneral ?? "—"}
                  </td>
                  <td className="hidden px-3 py-2 text-xs text-muted-foreground lg:table-cell">
                    {row.niveauRisque ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section.tracks.includes("observations")) {
    if (structured.observations.length === 0) {
      return (
        <CompactEmpty
          title="Observations"
          message="Aucune observation enregistrée."
        />
      );
    }
    return (
      <SimpleTable
        title="Observations"
        headers={["Code", "Description", "Statut", "Date"]}
        rows={structured.observations.map((row) => [
          row.code ?? "—",
          row.description,
          row.statut,
          new Date(row.date).toLocaleDateString("fr-FR", { timeZone: "UTC" }),
        ])}
      />
    );
  }

  if (section.tracks.includes("investigations")) {
    if (structured.investigations.length === 0) {
      return (
        <CompactEmpty
          title="Investigations"
          message="Aucune investigation enregistrée."
        />
      );
    }
    return (
      <SimpleTable
        title="Investigations"
        headers={["Titre", "BET", "Statut"]}
        rows={structured.investigations.map((row) => [
          row.titre,
          row.bet ?? "—",
          row.statut,
        ])}
      />
    );
  }

  if (section.tracks.includes("decisions")) {
    if (structured.decisions.length === 0) {
      return (
        <CompactEmpty title="Décisions" message="Aucune décision enregistrée." />
      );
    }
    return (
      <SimpleTable
        title="Décisions"
        headers={["Type", "Description", "Date"]}
        rows={structured.decisions.map((row) => [
          row.type,
          row.description ?? "—",
          row.dateDecision
            ? new Date(row.dateDecision).toLocaleDateString("fr-FR", {
                timeZone: "UTC",
              })
            : "—",
        ])}
      />
    );
  }

  if (section.tracks.includes("interventions")) {
    if (structured.interventions.length === 0) {
      return (
        <CompactEmpty
          title="Interventions"
          message="Aucune intervention enregistrée."
        />
      );
    }
    return (
      <SimpleTable
        title="Interventions"
        headers={["Entreprise", "Description", "Début"]}
        rows={structured.interventions.map((row) => [
          row.entreprise ?? "—",
          row.description ?? "—",
          row.dateDebut
            ? new Date(row.dateDebut).toLocaleDateString("fr-FR", {
                timeZone: "UTC",
              })
            : "—",
        ])}
      />
    );
  }

  return null;
}
