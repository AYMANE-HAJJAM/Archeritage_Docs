/**
 * Pure folder-move invariants (no DB, no server-only).
 */
export class FolderMoveError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function assertFolderMoveAllowed(input: {
  folderId: string;
  newParentId: string | null;
  folderSectionId: string;
  parentSectionId?: string | null;
  descendantIds: Iterable<string>;
}): void {
  if (input.newParentId === input.folderId) {
    throw new FolderMoveError(
      400,
      "Un dossier ne peut pas être son propre parent.",
    );
  }
  if (input.newParentId) {
    if (
      input.parentSectionId != null &&
      input.parentSectionId !== input.folderSectionId
    ) {
      throw new FolderMoveError(
        400,
        "Déplacement vers une autre section interdit.",
      );
    }
    const descendants = new Set(input.descendantIds);
    if (descendants.has(input.newParentId)) {
      throw new FolderMoveError(
        400,
        "Impossible de déplacer un dossier sous l’un de ses descendants.",
      );
    }
  }
}
