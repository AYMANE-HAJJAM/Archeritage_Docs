"use client";

import { useState } from "react";
import { CreateDossierDialog } from "@/components/manage/create-dossier-dialog";
import { Button } from "@/components/ui/button";

export function CreateDossierDialogGate({
  territoireId,
}: {
  territoireId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Ajouter un dossier patrimonial
      </Button>
      <CreateDossierDialog
        open={open}
        onOpenChange={setOpen}
        territoireId={territoireId}
      />
    </>
  );
}
