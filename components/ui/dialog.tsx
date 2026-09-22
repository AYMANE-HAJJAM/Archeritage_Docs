"use client";
import * as React from "react";
import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export const Dialog = Primitive.Root;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;
export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--foreground)_40%,transparent)] backdrop-blur-[1px]" />
      <Primitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[92dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-sm border border-border bg-surface p-6 shadow-[0_16px_48px_rgba(28,27,25,0.12)]",
          className,
        )}
        {...props}
      >
        {children}
        <Primitive.Close
          className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Fermer"
        >
          <X className="size-5" />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
