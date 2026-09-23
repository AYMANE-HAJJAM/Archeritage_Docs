"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { InviteUserDialog } from "@/components/admin/invite-user-dialog";
import { UserRowActions } from "@/components/admin/user-row-actions";
import type { AccessPlatform } from "@/components/admin/permission-matrix";
import type { UsersTableRow } from "@/lib/admin/user-row";
import { EmptyState } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";

export type { UsersTableRow };

function statusLabel(status: UsersTableRow["status"]) {
  if (status === "ACTIVE") return "Actif";
  if (status === "INVITED") return "Invité";
  return "Désactivé";
}

function statusTone(status: UsersTableRow["status"]) {
  if (status === "ACTIVE") return "active";
  if (status === "INVITED") return "invited";
  return "disabled";
}

function roleLabel(role: UsersTableRow["role"]) {
  return role === "ADMIN" ? "Administrateur" : "Utilisateur";
}

export function UsersManagement({
  users: initialUsers,
  platforms,
  initialQuery = "",
}: {
  users: UsersTableRow[];
  platforms: AccessPlatform[];
  initialQuery?: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [usersSource, setUsersSource] = useState(initialUsers);
  if (initialUsers !== usersSource) {
    setUsersSource(initialUsers);
    setUsers(initialUsers);
  }
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<number | null>(null);
  function upsertUser(row: UsersTableRow) {
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === row.id);
      if (idx === -1) return [row, ...prev];
      const next = [...prev];
      next[idx] = row;
      return next;
    });
  }

  function navigateSearch(value: string) {
    const next = value.trim();
    const params = new URLSearchParams();
    if (next) params.set("q", next);
    const href = params.toString() ? `/users?${params}` : "/users";
    startTransition(() => {
      router.replace(href);
    });
  }

  const inviteTrigger = (
    <button
      type="button"
      className="inline-flex h-9 items-center rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_88%,white)]"
    >
      Inviter un collaborateur
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3 sm:max-w-md">
          <label className="relative block">
          <span className="sr-only">Rechercher un utilisateur</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            key={initialQuery}
            defaultValue={initialQuery}
            onChange={(e) => {
              const value = e.target.value;
              if (debounceRef.current) window.clearTimeout(debounceRef.current);
              debounceRef.current = window.setTimeout(() => {
                navigateSearch(value);
              }, 300);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (debounceRef.current) window.clearTimeout(debounceRef.current);
                navigateSearch((e.target as HTMLInputElement).value);
              }
            }}
            placeholder="Rechercher un utilisateur…"
            className="h-9 pl-8"
            aria-busy={pending}
          />
          </label>
          {users.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {users.length === 1
                ? "1 compte affiché"
                : `${users.length} comptes affichés`}
              {initialQuery ? ` pour « ${initialQuery} »` : ""}
            </p>
          ) : null}
        </div>
        {users.length > 0 || initialQuery ? (
          <InviteUserDialog
            platforms={platforms}
            onUserCreated={upsertUser}
            trigger={inviteTrigger}
          />
        ) : null}
      </div>

      {users.length === 0 ? (
        <EmptyState
          title={
            initialQuery
              ? "Aucun résultat"
              : "Aucun collaborateur pour le moment"
          }
          description={
            initialQuery
              ? "Aucun compte ne correspond à cette recherche. Essayez un autre nom ou e-mail."
              : "Invitez votre première personne pour lui donner accès aux dossiers patrimoniaux."
          }
          action={
            !initialQuery ? (
              <InviteUserDialog
                platforms={platforms}
                onUserCreated={upsertUser}
                trigger={inviteTrigger}
              />
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto border border-border bg-surface">
          <table className="data-table min-w-[720px]">
            <thead>
              <tr>
                <th>Nom</th>
                <th>E-mail</th>
                <th className="w-32">Rôle</th>
                <th className="w-28">Statut</th>
                <th>Accès</th>
                <th className="w-44 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="align-middle">
                  <td className="whitespace-nowrap font-medium text-foreground">
                    {user.firstName} {user.lastName}
                  </td>
                  <td className="max-w-[14rem] truncate text-muted-foreground">
                    {user.email}
                  </td>
                  <td className="whitespace-nowrap text-sm">
                    {roleLabel(user.role)}
                  </td>
                  <td>
                    <span
                      className="status-pill"
                      data-tone={statusTone(user.status)}
                    >
                      {statusLabel(user.status)}
                    </span>
                  </td>
                  <td>
                    <AccessCell role={user.role} labels={user.accessLabels} />
                  </td>
                  <td className="text-right">
                    <UserRowActions
                      user={user}
                      platforms={platforms}
                      projectAccess={user.projectAccess}
                      onUserUpdated={upsertUser}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AccessCell({
  role,
  labels,
}: {
  role: "ADMIN" | "USER";
  labels: string[];
}) {
  if (role === "ADMIN") {
    return (
      <span className="text-xs font-medium text-muted-foreground">
        Accès complet
      </span>
    );
  }
  if (!labels.length) {
    return <span className="text-xs text-muted-foreground">Aucun accès</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((label) => (
        <span
          key={label}
          className="inline-flex max-w-[9.5rem] truncate border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-foreground"
          title={label}
        >
          {label}
        </span>
      ))}
    </div>
  );
}
