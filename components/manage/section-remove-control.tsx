"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  deleteSectionAction,
  setSectionActiveAction,
  type LiveSection,
  type ProjectActionState,
} from "@/app/(private)/manage/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const initial: ProjectActionState = {};

export type RemovableSection = Pick<
  LiveSection,
  "id" | "name" | "code" | "isActive" | "hasLinkedContent" | "documentCount"
>;

/**
 * Discreet trash control for structure rows / inspector.
 * Empty sections → hard delete. Linked content → deactivate only.
 */
export function SectionRemoveControl({
  projectId,
  section,
  onDeleted,
  onDeactivated,
  className,
}: {
  projectId: string;
  section: RemovableSection;
  onDeleted: (id: string) => void;
  onDeactivated?: (section: LiveSection) => void;
  className?: string;
}) {
  const { pushToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [delState, delAction, deleting] = useActionState(
    deleteSectionAction,
    initial,
  );
  const [updState, updAction, updating] = useActionState(
    setSectionActiveAction,
    initial,
  );
  const deleteFormRef = useRef<HTMLFormElement>(null);
  const deactivateFormRef = useRef<HTMLFormElement>(null);
  const deleteWasPending = useRef(false);
  const updateWasPending = useRef(false);
  const pending = deleting || updating;
  const blocked = section.hasLinkedContent;

  useEffect(() => {
    const finished = deleteWasPending.current && !deleting;
    deleteWasPending.current = deleting;
    if (!finished) return;
    if (delState.ok && delState.deletedId) {
      onDeleted(delState.deletedId);
      pushToast("Rubrique supprimée.", "success");
    } else if (delState.error) {
      pushToast(delState.error || "Impossible de supprimer cette rubrique.", "error");
    }
  }, [deleting, delState, onDeleted, pushToast]);

  useEffect(() => {
    const finished = updateWasPending.current && !updating;
    updateWasPending.current = updating;
    if (!finished) return;
    if (updState.ok && updState.section) {
      onDeactivated?.(updState.section);
      pushToast("Rubrique désactivée.", "success");
    } else if (updState.error) {
      pushToast(updState.error, "error");
    }
  }, [updating, updState, onDeactivated, pushToast]);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        title="Supprimer la rubrique"
        aria-label="Supprimer la rubrique"
        onClick={(e) => {
          e.stopPropagation();
          setConfirmOpen(true);
        }}
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
          "hover:bg-destructive/10 hover:text-destructive",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:opacity-50",
          className,
        )}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>

      <form ref={deleteFormRef} action={delAction} className="hidden">
        <input type="hidden" name="sectionId" value={section.id} />
        <input type="hidden" name="projectId" value={projectId} />
      </form>
      <form ref={deactivateFormRef} action={updAction} className="hidden">
        <input type="hidden" name="sectionId" value={section.id} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="isActive" value="0" />
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          blocked
            ? "Cette rubrique ne peut pas être supprimée"
            : "Supprimer cette rubrique ?"
        }
        description={
          blocked
            ? "Cette rubrique contient des documents ou des données liées. Elle ne peut pas être supprimée définitivement."
            : "Cette action supprimera définitivement la rubrique."
        }
        confirmLabel={
          blocked
            ? section.isActive
              ? "Désactiver la rubrique"
              : "Compris"
            : "Supprimer"
        }
        destructive={!blocked || section.isActive}
        pending={pending}
        onConfirm={() => {
          setConfirmOpen(false);
          if (blocked) {
            if (section.isActive) {
              deactivateFormRef.current?.requestSubmit();
            }
            return;
          }
          deleteFormRef.current?.requestSubmit();
        }}
      />
    </>
  );
}
