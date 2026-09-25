"use client";

import {
  DocumentaryFolderBrowser,
  type FolderCard,
  type MoveTarget,
} from "@/components/heritage/documentary-folder-browser";
import { PartsGrid, type PartCardModel } from "@/components/heritage/parts-landing";
import {
  ProjectWorkspaceHeader,
  SectionExplorer,
} from "@/components/heritage/section-explorer";
import { StickyContextNav } from "@/components/heritage/sticky-context-nav";
import type { ProjectPermissionFlags } from "@/lib/access/permissions";
import type { BreadcrumbItem } from "@/lib/structure/breadcrumb";
import type { SectionFile, StructureGroup } from "@/lib/structure/queries";
import { formatSize } from "@/lib/utils";

export type SelectedSection = {
  id: string;
  name: string;
  code: string | null;
};

export type ProjectSummary = {
  sectionCount: number;
  fileCount: number;
  totalBytes: number;
};

export function HeritageWorkspace({
  breadcrumb,
  eyebrow,
  title,
  projectSlug,
  groups,
  parts = [],
  fileCounts,
  summary,
  selectedSection = null,
  documents = [],
  currentFolderId = null,
  folders = [],
  moveTargets = [],
  permissions,
}: {
  breadcrumb: BreadcrumbItem[];
  eyebrow: string;
  title: string;
  projectSlug: string;
  groups: StructureGroup[];
  parts?: PartCardModel[];
  fileCounts: Record<string, number>;
  summary: ProjectSummary;
  selectedSection?: SelectedSection | null;
  documents?: SectionFile[];
  currentFolderId?: string | null;
  folders?: FolderCard[];
  moveTargets?: MoveTarget[];
  permissions: ProjectPermissionFlags;
}) {
  const summaryLine = selectedSection
    ? null
    : [
        `${summary.sectionCount} rubrique${summary.sectionCount > 1 ? "s" : ""}`,
        `${summary.fileCount} document${summary.fileCount > 1 ? "s" : ""}`,
        summary.totalBytes > 0 ? `Total : ${formatSize(summary.totalBytes)}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <>
      <StickyContextNav items={breadcrumb} />
      <section className="mx-auto max-w-6xl pb-10 pt-1 sm:pt-2">
        <ProjectWorkspaceHeader
          projectSlug={projectSlug}
          eyebrow={eyebrow}
          title={title}
          summaryLine={summaryLine}
        />

        {selectedSection ? (
          <DocumentaryFolderBrowser
            projectSlug={projectSlug}
            sectionId={selectedSection.id}
            currentFolderId={currentFolderId}
            folders={folders}
            documents={documents}
            moveTargets={moveTargets}
            canManage={permissions.canManageStructure}
            canUpload={permissions.canUpload}
            canDownload={permissions.canDownload}
            canDelete={permissions.canDeleteDocuments}
          />
        ) : (
          <>
            <PartsGrid projectSlug={projectSlug} parts={parts} />
            {parts.length > 0 && groups.length === 0 ? null : (
              <SectionExplorer
                projectSlug={projectSlug}
                groups={groups}
                fileCounts={fileCounts}
              />
            )}
          </>
        )}
      </section>
    </>
  );
}
