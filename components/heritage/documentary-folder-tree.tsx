"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  FolderPlus,
  Trash2,
  ArrowRightLeft,
} from "lucide-react";
import { cn, formatSize } from "@/lib/utils";
import type { DocumentaryFolderTreeNode } from "@/lib/heritage/documentary-folder-types";

export type FolderTreeActions = {
  onSelect?: (folderId: string) => void;
  onRename?: (folderId: string) => void;
  onCreateChild?: (folderId: string) => void;
  onMove?: (folderId: string) => void;
  onDelete?: (folderId: string) => void;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

function FolderMenu({
  folderId,
  actions,
}: {
  folderId: string;
  actions: FolderTreeActions;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const items = [
    actions.onRename
      ? { label: "Renommer", icon: Pencil, run: () => actions.onRename?.(folderId) }
      : null,
    actions.onCreateChild
      ? {
          label: "Nouveau sous-dossier",
          icon: FolderPlus,
          run: () => actions.onCreateChild?.(folderId),
        }
      : null,
    actions.onMove
      ? {
          label: "Déplacer",
          icon: ArrowRightLeft,
          run: () => actions.onMove?.(folderId),
        }
      : null,
    actions.onDelete
      ? {
          label: "Supprimer",
          icon: Trash2,
          run: () => actions.onDelete?.(folderId),
          danger: true,
        }
      : null,
  ].filter(Boolean) as {
    label: string;
    icon: typeof Pencil;
    run: () => void;
    danger?: boolean;
  }[];

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreHorizontal className="size-3.5" />
        <span className="sr-only">Actions du dossier</span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[11rem] border border-border bg-surface py-1 shadow-[var(--shadow-panel)]"
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted",
                  item.danger && "text-destructive",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.run();
                }}
              >
                <Icon className="size-3.5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  selectedId,
  expanded,
  onToggle,
  actions,
  canManage,
}: {
  node: DocumentaryFolderTreeNode;
  depth: number;
  selectedId: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  actions: FolderTreeActions;
  canManage: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const Icon = isExpanded ? FolderOpen : Folder;

  const meta = [
    node.childFolderCount > 0
      ? node.childFolderCount === 1
        ? "1 sous-dossier"
        : `${node.childFolderCount} sous-dossiers`
      : null,
    node.documentCount > 0
      ? node.documentCount === 1
        ? "1 document"
        : `${node.documentCount} documents`
      : null,
    node.totalBytes > 0 ? formatSize(node.totalBytes) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-sm py-1 pr-1",
          isSelected && "bg-muted/60",
        )}
        style={{ paddingLeft: `${depth * 0.85 + 0.25}rem` }}
      >
        <button
          type="button"
          className="inline-flex size-6 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={isExpanded ? "Replier" : "Déplier"}
          aria-expanded={hasChildren ? isExpanded : undefined}
          disabled={!hasChildren}
          onClick={() => hasChildren && onToggle(node.id)}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )
          ) : (
            <span className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left"
          onClick={() => actions.onSelect?.(node.id)}
          aria-current={isSelected ? "true" : undefined}
        >
          <Icon className="size-3.5 shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
            {node.name}
          </span>
          {meta ? (
            <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">
              {meta}
            </span>
          ) : null}
        </button>
        {canManage ? (
          <FolderMenu
            folderId={node.id}
            actions={{
              onRename: actions.onRename,
              onCreateChild: actions.onCreateChild,
              onMove: actions.onMove,
              onDelete: actions.onDelete,
            }}
          />
        ) : null}
      </div>
      {hasChildren && isExpanded ? (
        <ul role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              onToggle={onToggle}
              actions={actions}
              canManage={canManage}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function collectExpandableIds(list: DocumentaryFolderTreeNode[]): string[] {
  const ids: string[] = [];
  for (const n of list) {
    if (n.children.length) {
      ids.push(n.id, ...collectExpandableIds(n.children));
    }
  }
  return ids;
}

/**
 * Reusable recursive documentary folder tree (unlimited nesting).
 */
export function DocumentaryFolderTree({
  nodes,
  selectedId = null,
  canManage = false,
  defaultExpanded = true,
  actions = {},
  className,
}: {
  nodes: DocumentaryFolderTreeNode[];
  selectedId?: string | null;
  canManage?: boolean;
  defaultExpanded?: boolean;
  actions?: FolderTreeActions;
  className?: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    defaultExpanded ? new Set(collectExpandableIds(nodes)) : new Set(),
  );
  const [nodesSource, setNodesSource] = useState(nodes);
  if (nodes !== nodesSource) {
    setNodesSource(nodes);
    if (defaultExpanded) setExpanded(new Set(collectExpandableIds(nodes)));
  }

  function onToggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (nodes.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Aucun dossier documentaire.
      </p>
    );
  }

  return (
    <ul
      role="tree"
      aria-label="Dossiers documentaires"
      className={cn("space-y-0.5", className)}
    >
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          expanded={expanded}
          onToggle={onToggle}
          actions={actions}
          canManage={canManage}
        />
      ))}
    </ul>
  );
}

export function folderMetaLine(folder: {
  childFolderCount: number;
  documentCount: number;
  totalBytes: number;
  lastActivityAt: string | null;
}): string {
  const parts = [
    folder.childFolderCount > 0
      ? folder.childFolderCount === 1
        ? "1 sous-dossier"
        : `${folder.childFolderCount} sous-dossiers`
      : null,
    folder.documentCount > 0
      ? folder.documentCount === 1
        ? "1 document"
        : `${folder.documentCount} documents`
      : null,
    folder.totalBytes > 0 ? formatSize(folder.totalBytes) : null,
    folder.lastActivityAt
      ? `Dernière mise à jour : ${formatDate(folder.lastActivityAt)}`
      : null,
  ].filter(Boolean);
  return parts.join(" · ");
}
