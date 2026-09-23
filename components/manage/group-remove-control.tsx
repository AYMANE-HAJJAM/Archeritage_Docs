"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  deleteGroupAction,
  type ProjectActionState,
} from "@/app/(private)/manage/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const initial: ProjectActionState = {};

/**
 * Group trash control — hard-delete only when the group has no sections.
 */
export function GroupRemoveControl({
  groupId,
  sectionCount,
  onDeleted,
  className,
}: {
  groupId: string;
  sectionCount: number;
  onDeleted: (id: string) => void;
  className?: string;
}) {
  const { pushToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteGroupAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  const blocked = sectionCount > 0;

  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!finished) return;
    if (state.ok && state.deletedId) {
      onDeleted(state.deletedId);
      pushToast("Groupe supprimé.", "success");
    } else if (state.error) {
      pushToast(state.error, "error");
    }
  }, [pending, state, onDeleted, pushToast]);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        title={
          blocked
            ? "Ce groupe contient des rubriques"
            : "Supprimer le groupe"
        }
        aria-label={
          blocked
            ? "Ce groupe contient des rubriques"
            : "Supprimer le groupe"
        }
        onClick={(e) => {
          e.stopPropagation();
          setConfirmOpen(true);
        }}
        className={cn(
          "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
          "hover:bg-destructive/10 hover:text-destructive",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:opacity-50",
          className,
        )}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>

      <form ref={formRef} action={action} className="hidden">
        <input type="hidden" name="groupId" value={groupId} />
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          blocked
            ? "Impossible de supprimer ce groupe"
            : "Supprimer ce groupe ?"
        }
        description={
          blocked
            ? "Ce groupe contient des rubriques. Déplacez ou retirez-les d’abord — les rubriques enfants ne sont pas supprimées automatiquement."
            : "Cette action retirera définitivement le groupe vide."
        }
        confirmLabel={blocked ? "Compris" : "Supprimer"}
        destructive={!blocked}
        pending={pending}
        onConfirm={() => {
          setConfirmOpen(false);
          if (blocked) return;
          formRef.current?.requestSubmit();
        }}
      />
    </>
  );
}
