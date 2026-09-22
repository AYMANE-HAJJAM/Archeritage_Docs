"use client";

import { useActionState } from "react";
import {
  updateUserProjectAccessAction,
  updateUserTerritoireAccessAction,
  type ManageUserActionState,
} from "@/app/(private)/manage/user-actions";

const initial: ManageUserActionState = {};

export type AccessDossier = {
  id: string;
  name: string;
  code: string | null;
};

export type AccessPlatform = {
  id: string;
  name: string;
  dossiers: AccessDossier[];
};

export type ProjectAccessFlags = {
  canView: boolean;
  canUpload: boolean;
  canEditDossier: boolean;
  canManageStructure: boolean;
  canReclassifyDocuments: boolean;
};

export function UserAccessPanel({
  userId,
  userRole,
  platforms,
  projectAccess,
  territoireAccess,
}: {
  userId: string;
  userRole: "ADMIN" | "USER";
  platforms: AccessPlatform[];
  projectAccess: Record<string, ProjectAccessFlags>;
  territoireAccess: Record<string, { canCreateDossier: boolean }>;
}) {
  if (userRole === "ADMIN") {
    return (
      <div className="mt-3 border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Accès</p>
        <p className="mt-1">
          Les administrateurs ont un accès complet à la plateforme — aucun
          paramétrage par dossier.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-4 border border-border p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Accès
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Permissions explicites par dossier. Défaut : aucun accès.
        </p>
      </div>

      {platforms.map((platform) => (
        <div key={platform.id} className="space-y-3">
          <p className="text-sm font-medium">{platform.name}</p>

          <TerritoireAccessForm
            userId={userId}
            territoireId={platform.id}
            canCreateDossier={
              territoireAccess[platform.id]?.canCreateDossier ?? false
            }
          />

          <div className="space-y-2">
            {platform.dossiers.map((dossier) => (
              <ProjectAccessForm
                key={dossier.id}
                userId={userId}
                dossier={dossier}
                flags={
                  projectAccess[dossier.id] ?? {
                    canView: false,
                    canUpload: false,
                    canEditDossier: false,
                    canManageStructure: false,
                    canReclassifyDocuments: false,
                  }
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TerritoireAccessForm({
  userId,
  territoireId,
  canCreateDossier,
}: {
  userId: string;
  territoireId: string;
  canCreateDossier: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateUserTerritoireAccessAction,
    initial,
  );

  return (
    <form
      action={action}
      className="flex flex-wrap items-center gap-3 rounded border border-border/70 bg-muted/15 px-2 py-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="territoireId" value={territoireId} />
      <label className="inline-flex items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          name="canCreateDossier"
          value="1"
          defaultChecked={canCreateDossier}
        />
        Créer des dossiers patrimoniaux
      </label>
      <button
        type="submit"
        disabled={pending}
        className="ml-auto text-[11px] font-medium underline-offset-2 hover:underline disabled:opacity-60"
      >
        {pending ? "…" : "Enregistrer"}
      </button>
      {state.error ? (
        <p className="w-full text-[11px] text-destructive">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="w-full text-[11px] text-muted-foreground">Enregistré.</p>
      ) : null}
    </form>
  );
}

function ProjectAccessForm({
  userId,
  dossier,
  flags,
}: {
  userId: string;
  dossier: AccessDossier;
  flags: ProjectAccessFlags;
}) {
  const [state, action, pending] = useActionState(
    updateUserProjectAccessAction,
    initial,
  );

  return (
    <form
      action={action}
      className="space-y-2 rounded border border-border/70 px-2 py-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="projectId" value={dossier.id} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium">
          {dossier.name}
          {dossier.code ? (
            <span className="ml-1.5 text-muted-foreground">({dossier.code})</span>
          ) : null}
        </p>
        <button
          type="submit"
          disabled={pending}
          className="text-[11px] font-medium underline-offset-2 hover:underline disabled:opacity-60"
        >
          {pending ? "…" : "Enregistrer"}
        </button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        <PermCheck name="canView" label="Voir" defaultChecked={flags.canView} />
        <PermCheck
          name="canUpload"
          label="Importer"
          defaultChecked={flags.canUpload}
        />
        <PermCheck
          name="canManageStructure"
          label="Gérer structure"
          defaultChecked={flags.canManageStructure}
        />
        <PermCheck
          name="canReclassifyDocuments"
          label="Reclasser documents"
          defaultChecked={flags.canReclassifyDocuments}
        />
      </div>
      {state.error ? (
        <p className="text-[11px] text-destructive">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-[11px] text-muted-foreground">Enregistré.</p>
      ) : null}
    </form>
  );
}

function PermCheck({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs">
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={defaultChecked}
      />
      {label}
    </label>
  );
}
