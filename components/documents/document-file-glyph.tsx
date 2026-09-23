"use client";

import {
  FileSpreadsheet,
  FileText,
  Film,
  ImageIcon,
  Presentation,
} from "lucide-react";
import { useState } from "react";

import {
  fileThumbnailUrl,
  isImageFile,
  isVideoFile,
  normalizeExtension,
  type PreviewableFile,
} from "@/lib/documents/file-kind";
import { cn } from "@/lib/utils";

function TypeIcon({
  file,
  className,
}: {
  file: Pick<PreviewableFile, "extension" | "mimeType" | "storageProvider">;
  className?: string;
}) {
  const ext = normalizeExtension(file.extension);
  if (isVideoFile(file)) {
    return <Film className={cn("size-4 text-muted-foreground", className)} />;
  }
  if (ext === "pdf") {
    return <FileText className={cn("size-4 text-rose-700/80", className)} />;
  }
  if (ext === "xlsx" || ext === "xls" || ext === "ods" || ext === "csv") {
    return (
      <FileSpreadsheet className={cn("size-4 text-emerald-700/80", className)} />
    );
  }
  if (ext === "pptx" || ext === "ppt" || ext === "odp") {
    return (
      <Presentation className={cn("size-4 text-orange-700/80", className)} />
    );
  }
  if (ext === "docx" || ext === "doc" || ext === "odt" || ext === "rtf") {
    return <FileText className={cn("size-4 text-sky-800/80", className)} />;
  }
  if (isImageFile(file)) {
    return <ImageIcon className={cn("size-4 text-muted-foreground", className)} />;
  }
  return <FileText className={cn("size-4 text-muted-foreground", className)} />;
}

/**
 * Compact glyph for document tables: real image thumbnail, video poster
 * placeholder, or type-specific icon.
 */
export function DocumentFileGlyph({
  file,
  className,
}: {
  file: Pick<
    PreviewableFile,
    "id" | "displayName" | "extension" | "mimeType" | "storageProvider"
  >;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImageThumb = isImageFile(file) && !failed;

  if (showImageThumb) {
    return (
      <span
        className={cn(
          "relative inline-flex size-11 shrink-0 overflow-hidden rounded-sm border border-border/80 bg-muted",
          className,
        )}
      >
        {/* Authenticated proxy — not Next/Image (private bytes). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileThumbnailUrl(file.id)}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  if (isVideoFile(file)) {
    return (
      <span
        className={cn(
          "relative inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border/80 bg-[color-mix(in_srgb,var(--foreground)_88%,transparent)]",
          className,
        )}
        aria-hidden
      >
        <Film className="size-4 text-white/85" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-5 items-center justify-center rounded-full bg-white/20">
            <span className="ml-0.5 border-y-[5px] border-l-[8px] border-y-transparent border-l-white" />
          </span>
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-sm border border-border/70 bg-muted/60",
        className,
      )}
      aria-hidden
    >
      <TypeIcon file={file} />
    </span>
  );
}
