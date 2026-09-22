"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { SectionDocumentsList } from "@/components/heritage/section-documents-list";
import {
  HeritageWorkspaceHeader,
  SectionExplorer,
} from "@/components/heritage/section-explorer";
import {
  StructureEditMode,
  type EditableGroup,
  type EditableSection,
} from "@/components/heritage/structure-edit-mode";
import {
  SectionSummaryBar,
  sectionShowsStructuredTable,
} from "@/components/heritage/section-summary";
import { StructuredContentPanel } from "@/components/heritage/structured-content-panel";
import type { SectionDocument } from "@/lib/heritage/queries/section-documents";
import type { ProjectHeritageSummary } from "@/lib/heritage/queries/section-summaries";
import type { SectionStructuredData } from "@/lib/heritage/queries/section-structured";
import type {
  HeritageSection,
  HeritageStructure,
} from "@/lib/heritage/config/structure";
import type { ProjectPermissionFlags } from "@/lib/access/permissions";
import { formatSize } from "@/lib/utils";

type HeritageWorkspaceProps = {
  structure: HeritageStructure;
  selectedSection?: HeritageSection | null;
  summary: ProjectHeritageSummary;
  documents?: SectionDocument[];
  structured?: SectionStructuredData;
  territoryHref?: string;
  projectId?: string;
  permissions: ProjectPermissionFlags;
  structureEdit?: {
    groups: EditableGroup[];
    sections: EditableSection[];
  } | null;
  editMode?: boolean;
};

const EMPTY_STRUCTURED: SectionStructuredData = {
  sequences: [],
  observations: [],
  investigations: [],
  decisions: [],
  interventions: [],
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

export function HeritageWorkspace({
  structure,
  selectedSection = null,
  summary,
  documents = [],
  structured = EMPTY_STRUCTURED,
  territoryHref = "/territoires/saf",
  projectId,
  permissions,
  structureEdit = null,
  editMode = false,
}: HeritageWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const setEditMode = useCallback(
    (enabled: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      if (enabled) params.set("edit", "1");
      else params.delete("edit");
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const projectHref = `/projects/${structure.projectSlug}`;
  const inStructureEdit =
    Boolean(editMode && permissions.canManageStructure && structureEdit && projectId);

  const summaryLine = !selectedSection
    ? [
        `${summary.sectionCount} rubriques`,
        summary.totalFiles === 1
          ? "1 document"
          : `${summary.totalFiles} documents`,
        `${summary.documentedSections} rubrique${summary.documentedSections > 1 ? "s" : ""} documentée${summary.documentedSections > 1 ? "s" : ""}`,
        summary.sequenceCount > 0
          ? summary.sequenceCount === 1
            ? "1 séquence"
            : `${summary.sequenceCount} séquences`
          : null,
        summary.totalBytes > 0
          ? `Total : ${formatSize(summary.totalBytes)}`
          : null,
        summary.lastActivityAt
          ? `Dernière activité : ${formatDate(summary.lastActivityAt)}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const showsStructured = selectedSection
    ? sectionShowsStructuredTable(selectedSection)
    : false;

  return (
    <section className="mx-auto max-w-6xl pb-10 pt-2 sm:pt-4">
      <HeritageWorkspaceHeader
        structure={structure}
        selectedSectionLabel={
          selectedSection
            ? `${selectedSection.code} ${selectedSection.name}`
            : null
        }
        summaryLine={summaryLine}
        projectHref={projectHref}
        territoryHref={territoryHref}
        showBackToRubriques={Boolean(selectedSection)}
        canManageStructure={permissions.canManageStructure && !selectedSection}
        structureEditActive={inStructureEdit}
        onToggleStructureEdit={() => setEditMode(!inStructureEdit)}
      />

      {selectedSection ? (
        <div className="space-y-5">
          <SectionSummaryBar
            section={selectedSection}
            sectionSummary={summary.sections[selectedSection.code]}
          />
          {showsStructured && (
            <StructuredContentPanel
              section={selectedSection}
              structured={structured}
            />
          )}
          <SectionDocumentsList
            documents={documents}
            title={showsStructured ? "Documents liés" : "Documents"}
            canDownload={permissions.canDownload}
            uploadContext={
              projectId && permissions.canUpload
                ? {
                    documentScope: "PROJECT_SECTION",
                    docCategorie: selectedSection.code,
                    projectId,
                  }
                : undefined
            }
          />
        </div>
      ) : inStructureEdit && structureEdit && projectId ? (
        <StructureEditMode
          projectId={projectId}
          projectSlug={structure.projectSlug}
          groups={structureEdit.groups}
          sections={structureEdit.sections}
          onExit={() => setEditMode(false)}
        />
      ) : (
        <SectionExplorer structure={structure} summary={summary} />
      )}
    </section>
  );
}
