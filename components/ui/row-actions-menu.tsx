"use client";

import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type RowMenuAction = {
  id: string;
  label: string;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

/**
 * Row "…" menu — portaled via Radix so it is not clipped by table overflow.
 */
export function RowActionsMenu({
  actions,
  label = "Actions",
}: {
  actions: RowMenuAction[];
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-colors",
            "hover:border-border hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "data-[state=open]:border-border data-[state=open]:bg-muted data-[state=open]:text-foreground",
          )}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="bottom" sideOffset={6}>
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.id}
            disabled={action.disabled}
            destructive={action.destructive}
            onSelect={() => {
              action.onSelect?.();
            }}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
