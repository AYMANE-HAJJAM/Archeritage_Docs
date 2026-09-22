"use server";

/** @deprecated Prefer `@/app/(private)/manage/actions` — kept for legacy /admin imports. */
export {
  createProjectAction,
  updateProjectAction,
  createSectionAction,
  updateSectionAction,
  deleteSectionAction,
  createGroupAction,
  renameGroupAction,
  deleteGroupAction,
  reorderSectionsAction,
  reorderGroupsAction,
  reclassifyDocumentAction,
  type ProjectActionState,
} from "@/app/(private)/manage/actions";
