"use client";

import { useCallback, useState } from "react";

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

export type DossierFlags = {
  canView: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canManageStructure: boolean;
};

export function emptyFlags(): DossierFlags {
  return {
    canView: false,
    canUpload: false,
    canDownload: false,
    canManageStructure: false,
  };
}

/** Enforce Voir dependency rules. */
export function applyFlagChange(
  current: DossierFlags,
  key: keyof DossierFlags,
  value: boolean,
): DossierFlags {
  const next = { ...current, [key]: value };
  if (key === "canView" && !value) {
    return emptyFlags();
  }
  if (
    value &&
    (key === "canUpload" ||
      key === "canDownload" ||
      key === "canManageStructure")
  ) {
    next.canView = true;
  }
  return next;
}

type PermissionMatrixProps = {
  platforms: AccessPlatform[];
  projectAccess: Record<string, DossierFlags>;
  /** Controlled mode — when provided, parent owns state. */
  onProjectChange?: (projectId: string, flags: DossierFlags) => void;
  /** Uncontrolled / form mode — renders named checkboxes for FormData. */
  formMode?: boolean;
  disabled?: boolean;
};

export function PermissionMatrix({
  platforms,
  projectAccess,
  onProjectChange,
  formMode = true,
  disabled = false,
}: PermissionMatrixProps) {
  if (!platforms.length) {
    return (
      <p className="rounded-sm border border-dashed border-border px-3 py-4 text-xs leading-5 text-muted-foreground">
        Aucun dossier disponible. Créez d’abord un projet et des dossiers
        patrimoniaux.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {platforms.map((platform) => (
        <div key={platform.id} className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
              {platform.name}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Dossiers de cette plateforme
            </p>
          </div>

          <div className="space-y-2.5">
            {platform.dossiers.map((dossier) => {
              const flags = projectAccess[dossier.id] ?? emptyFlags();
              return (
                <DossierPermissionRow
                  key={dossier.id}
                  dossier={dossier}
                  flags={flags}
                  formMode={formMode}
                  disabled={disabled}
                  onChange={
                    onProjectChange
                      ? (next) => onProjectChange(dossier.id, next)
                      : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function DossierPermissionRow({
  dossier,
  flags,
  formMode,
  disabled,
  onChange,
}: {
  dossier: AccessDossier;
  flags: DossierFlags;
  formMode: boolean;
  disabled: boolean;
  onChange?: (flags: DossierFlags) => void;
}) {
  const [local, setLocal] = useState(flags);
  const current = onChange ? flags : local;

  const setFlag = useCallback(
    (key: keyof DossierFlags, value: boolean) => {
      const next = applyFlagChange(current, key, value);
      if (onChange) onChange(next);
      else setLocal(next);
    },
    [current, onChange],
  );

  const viewOff = !current.canView;

  return (
    <div className="space-y-2.5 border border-border bg-background/40 px-3 py-3">
      {formMode ? <input type="hidden" name="projectId" value={dossier.id} /> : null}
      <p className="text-sm font-medium text-foreground">
        {dossier.name}
        {dossier.code ? (
          <span className="ml-1.5 font-normal text-muted-foreground">
            ({dossier.code})
          </span>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2.5">
        <Perm
          label="Voir"
          name={formMode ? `canView_${dossier.id}` : undefined}
          checked={current.canView}
          disabled={disabled}
          formMode={formMode}
          onChange={(v) => setFlag("canView", v)}
        />
        <Perm
          label="Importer"
          name={formMode ? `canUpload_${dossier.id}` : undefined}
          checked={current.canUpload}
          disabled={disabled || viewOff}
          formMode={formMode}
          onChange={(v) => setFlag("canUpload", v)}
        />
        <Perm
          label="Télécharger"
          name={formMode ? `canDownload_${dossier.id}` : undefined}
          checked={current.canDownload}
          disabled={disabled || viewOff}
          formMode={formMode}
          onChange={(v) => setFlag("canDownload", v)}
        />
        <Perm
          label="Gérer la structure"
          name={formMode ? `canManageStructure_${dossier.id}` : undefined}
          checked={current.canManageStructure}
          disabled={disabled || viewOff}
          formMode={formMode}
          onChange={(v) => setFlag("canManageStructure", v)}
        />
      </div>
      {/* Hidden mirrors so disabled unchecked boxes still submit correctly via JS state... 
          actually disabled checkboxes don't submit. Use hidden fields for formMode. */}
      {formMode ? (
        <>
          <input
            type="hidden"
            name={`canView_${dossier.id}`}
            value={current.canView ? "1" : "0"}
          />
          <input
            type="hidden"
            name={`canUpload_${dossier.id}`}
            value={current.canUpload ? "1" : "0"}
          />
          <input
            type="hidden"
            name={`canDownload_${dossier.id}`}
            value={current.canDownload ? "1" : "0"}
          />
          <input
            type="hidden"
            name={`canManageStructure_${dossier.id}`}
            value={current.canManageStructure ? "1" : "0"}
          />
        </>
      ) : null}
    </div>
  );
}

function Perm({
  label,
  name,
  checked,
  disabled,
  formMode,
  onChange,
}: {
  label: string;
  name?: string;
  checked: boolean;
  disabled: boolean;
  formMode: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={`inline-flex items-center gap-1.5 text-xs ${disabled ? "opacity-50" : ""}`}
    >
      <input
        type="checkbox"
        name={formMode ? undefined : name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
