"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowLeft, Check, ChevronRight, Eye, FileText, Film, FolderClosed, FolderPlus, ImageIcon, LayoutGrid, List, Loader2, MoreHorizontal, MoveRight, Pencil, Trash2, Upload, X } from "lucide-react";
import type { LibraryData } from "@/lib/documents/library";
import { isVideoFile } from "@/lib/documents/file-kind";
import { cn, folderTrail, formatSize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LiveSearch } from "@/components/documents/live-search";
import { DocumentFileGlyph } from "@/components/documents/document-file-glyph";
import { FilePreviewModal } from "@/components/documents/file-preview";

type ArchiveFile = LibraryData["files"][number];
type Target = { kind: "folder" | "file"; id: string; name: string };
type Modal = { action: "create" } | { action: "rename" | "delete" | "move"; target: Target } | null;
type UploadItem = { name: string; progress: number; status: "waiting" | "uploading" | "done" | "error"; error?: string };
type OpenMenu = { target: Target; anchor: HTMLButtonElement };
type MenuPosition = { top: number; left: number };

export function Explorer({
  data: initialData,
  basePath,
  keepParams,
  canDeleteDocuments = false,
}: {
  data: LibraryData;
  /** When set (e.g. `/projects/.../documents`), folder links stay under the document library. */
  basePath?: string;
  /** Extra query params preserved on folder/root navigation (e.g. `{ view: "folders" }`). */
  keepParams?: Record<string, string>;
  /** When true, file delete is offered (ADMIN or USER with canDeleteDocuments). */
  canDeleteDocuments?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView] = useState<"grid" | "list">(() => initialData.counts.images > initialData.counts.documents && initialData.counts.images > 0 ? "grid" : "list");
  const [modal, setModal] = useState<Modal>(null);
  const [preview, setPreview] = useState<ArchiveFile | null>(null);
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [liveData, setLiveData] = useState<LibraryData | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, left: 0 });
  const [dragging, setDragging] = useState(false);
  const uploading = useRef(false);
  const dragDepth = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRequest = useRef<AbortController | null>(null);
  const data = liveData ? { ...liveData, current: initialData.current, trail: initialData.trail, allFolders: initialData.allFolders, projectSummary: initialData.projectSummary } : initialData;
  const projectUrl = (() => {
    const base = basePath ?? `/projects/${data.project.slug}`;
    if (!keepParams || Object.keys(keepParams).length === 0) return base;
    const params = new URLSearchParams(keepParams);
    return `${base}?${params.toString()}`;
  })();
  const folderUrl = (id: string | null) => {
    if (!id) return projectUrl;
    const params = new URLSearchParams(keepParams);
    params.set("folder", id);
    return `${basePath ?? `/projects/${data.project.slug}`}?${params.toString()}`;
  };
  const isUploading = uploads.some((u) => u.status === "waiting" || u.status === "uploading");
  const showFileSize = data.files.length > 0;

  const search = async (query: string) => {
    searchRequest.current?.abort();
    if (!query) {
      setLiveData(null);
      setSearchLoading(false);
      return;
    }
    const controller = new AbortController();
    searchRequest.current = controller;
    setSearchLoading(true);
    try {
      const params = new URLSearchParams({ q: query, type: initialData.filter });
      if (initialData.current) params.set("folder", initialData.current.id);
      const response = await fetch(`/api/projects/${initialData.project.slug}/search?${params}`, { credentials: "same-origin", signal: controller.signal });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) throw new Error("La recherche a échoué.");
      setLiveData(await response.json() as LibraryData);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice(error instanceof Error ? error.message : "La recherche a échoué.");
    } finally {
      if (searchRequest.current === controller) setSearchLoading(false);
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem("archeritage-view");
      if (stored === "list" || stored === "grid") {
        // Preference is read after hydration to keep server and client markup identical.
        queueMicrotask(() => setView(stored));
      }
    } catch { /* Browsing still works if local storage is disabled. */ }
  }, []);
  useEffect(() => {
    if (!isUploading) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isUploading]);
  useLayoutEffect(() => {
    if (!openMenu) return;
    const updatePosition = () => {
      const menu = menuRef.current;
      if (!menu) return;
      const anchorRect = openMenu.anchor.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const margin = 8;
      const left = Math.min(Math.max(margin, anchorRect.right - menuRect.width), window.innerWidth - menuRect.width - margin);
      const below = anchorRect.bottom + margin;
      const above = anchorRect.top - menuRect.height - margin;
      const top = below + menuRect.height <= window.innerHeight - margin ? below : Math.max(margin, above);
      setMenuPosition({ top, left });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [openMenu]);
  useEffect(() => {
    if (!openMenu) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !menuRef.current?.contains(target) && !openMenu.anchor.contains(target)) setOpenMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenMenu(null); };
    document.addEventListener("pointerdown", closeOnOutsideClick, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenu]);

  function chooseView(value: "grid" | "list") { setView(value); try { localStorage.setItem("archeritage-view", value); } catch {} }
  function queryUrl(values: { type?: string; page?: number }) {
    const params = new URLSearchParams(keepParams);
    if (data.q) params.set("q", data.q);
    else if (data.current) params.set("folder", data.current.id);
    params.set("type", values.type ?? data.filter);
    if (values.page) params.set("page", String(values.page));
    return `${pathname}?${params}`;
  }
  function openModal(value: NonNullable<Modal>) {
    setError(""); setName("target" in value ? value.target.name : ""); setDestination(""); setModal(value);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!modal) return;
    setBusy(true); setError("");
    try {
      const url = modal.action === "create" ? "/api/folders" : `/api/${modal.target.kind === "folder" ? "folders" : "files"}/${modal.target.id}`;
      const body = modal.action === "create" ? { name, projectId: data.project.id, parentId: data.current?.id ?? null }
        : modal.action === "move" ? { folderId: destination }
        : modal.action === "rename" ? { [modal.target.kind === "folder" ? "name" : "displayName"]: name } : undefined;
      const response = await fetch(url, { method: modal.action === "create" ? "POST" : modal.action === "delete" ? "DELETE" : "PATCH", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "L’opération a échoué.");
      setModal(null); setNotice(modal.action === "delete" ? "Élément supprimé." : modal.action === "move" ? "Fichier déplacé." : modal.action === "create" ? "Dossier créé." : "Nom mis à jour."); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "L’opération a échoué."); }
    finally { setBusy(false); }
  }
  async function uploadFiles(selected: FileList | File[]) {
    if (!data.current || uploading.current || !selected.length) return;
    uploading.current = true;
    const files = Array.from(selected);
    setUploads(files.map((f) => ({ name: f.name, progress: 0, status: "waiting" })));
    const update = (index: number, patch: Partial<UploadItem>) => setUploads((items) => items.map((item, i) => i === index ? { ...item, ...patch } : item));
    try {
      for (const [index, file] of files.entries()) {
        if (file.size > data.maxBytes || file.size === 0) { update(index, { status: "error", error: `Fichier vide ou supérieur à ${formatSize(data.maxBytes)}.` }); continue; }
        update(index, { status: "uploading" });
        try {
          await new Promise<void>((resolve, reject) => {
            const request = new XMLHttpRequest();
            request.open("POST", "/api/files"); request.timeout = 120000;
            request.upload.onprogress = (event) => { if (event.lengthComputable) update(index, { progress: Math.min(95, Math.round(event.loaded / event.total * 95)) }); };
            request.onload = () => {
              if (request.status >= 200 && request.status < 300) resolve();
              else { let message = "L’envoi a échoué."; try { message = JSON.parse(request.responseText).error || message; } catch {} reject(new Error(message)); }
            };
            request.onerror = () => reject(new Error("Connexion interrompue. Vérifiez le dossier avant de réessayer."));
            request.ontimeout = () => reject(new Error("Délai dépassé. Vérifiez le dossier avant de réessayer."));
            const form = new FormData(); form.append("file", file); form.append("folderId", data.current!.id); form.append("projectId", data.project.id); request.send(form);
          });
          update(index, { status: "done", progress: 100 });
        } catch (error) { update(index, { status: "error", error: error instanceof Error ? error.message : "L’envoi a échoué." }); }
      }
    } finally { uploading.current = false; if (input.current) input.current.value = ""; router.refresh(); }
  }
  function actions(target: Target) {
    const isOpen = openMenu?.target.id === target.id;
    return <div className="flex justify-end"><button type="button" className="flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Actions pour ${target.name}`} aria-haspopup="menu" aria-expanded={isOpen} onClick={(event) => setOpenMenu(isOpen ? null : { target, anchor: event.currentTarget })}><MoreHorizontal className="size-4" /></button></div>;
  }
  function actionMenu() {
    if (!openMenu) return null;
    const { target } = openMenu;
    const file = target.kind === "file" ? data.files.find((candidate) => candidate.id === target.id) : null;
    const run = (callback: () => void) => { setOpenMenu(null); callback(); };
    return createPortal(<div ref={menuRef} role="menu" className="fixed z-[100] min-w-40 rounded-sm border bg-background p-1 text-sm shadow-lg" style={{ top: menuPosition.top, left: menuPosition.left }}>
      {file && <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left hover:bg-muted" onClick={() => run(() => setPreview(file))}><Eye className="size-3.5" />Aperçu</button>}
      {target.kind === "file" && <a role="menuitem" href={`/api/files/${target.id}/content?download=1`} className="flex items-center gap-2 rounded-sm px-2.5 py-2 hover:bg-muted" onClick={() => setOpenMenu(null)}><ArrowDownToLine className="size-3.5" />Télécharger</a>}
      <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left hover:bg-muted" onClick={() => run(() => openModal({ action: "rename", target }))}><Pencil className="size-3.5" />Renommer</button>
      {target.kind === "file" && <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left hover:bg-muted" onClick={() => run(() => openModal({ action: "move", target }))}><MoveRight className="size-3.5" />Déplacer</button>}
      {(target.kind === "folder" || canDeleteDocuments) && <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-destructive hover:bg-muted" onClick={() => run(() => openModal({ action: "delete", target }))}><Trash2 className="size-3.5" />Supprimer</button>}
    </div>, document.body);
  }

  return <div onDragEnter={(event) => { event.preventDefault(); if (data.current && event.dataTransfer.types.includes("Files")) { dragDepth.current++; setDragging(true); } }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { event.preventDefault(); if (--dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }} onDrop={(event) => { event.preventDefault(); dragDepth.current = 0; setDragging(false); void uploadFiles(event.dataTransfer.files); }}>
    <nav aria-label="Fil d’Ariane" className="mb-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><Link href="/projects" className="flex items-center gap-1 hover:text-primary"><ArrowLeft className="size-3" />Territoires</Link><ChevronRight className="size-3" /><Link href={projectUrl} aria-current={!data.current ? "page" : undefined} className="max-w-64 truncate hover:text-primary">{data.project.name}</Link>{data.trail.map((folder, index) => <span key={folder.id} className="flex min-w-0 items-center gap-1.5"><ChevronRight className="size-3 shrink-0" /><Link scroll={false} href={folderUrl(folder.id)} aria-current={index === data.trail.length - 1 ? "page" : undefined} className="max-w-56 truncate hover:text-primary">{folder.name.replace(/^\d+\s+—\s+/, "")}</Link></span>)}</nav>
    <div className="mb-3 flex min-h-10 items-start gap-3"><div className="min-w-0 flex-1"><h1 className="truncate text-xl font-semibold" title={data.current?.name ?? data.project.name}>{data.current?.name.replace(/^\d+\s+—\s+/, "") ?? data.project.name}</h1>{!data.current && !data.q && <p className="mt-1 text-xs text-muted-foreground">{data.projectSummary.rootFolders} dossier{data.projectSummary.rootFolders > 1 ? "s" : ""} · {data.projectSummary.documents} document{data.projectSummary.documents > 1 ? "s" : ""} · {data.projectSummary.images} image{data.projectSummary.images > 1 ? "s" : ""}</p>}</div>{data.current && !data.q && <Button asChild variant="ghost" size="sm"><Link scroll={false} href={data.current.parentId ? folderUrl(data.current.parentId) : projectUrl}><ArrowLeft />Retour</Link></Button>}</div>
    <input ref={input} type="file" multiple className="hidden" aria-label="Sélectionner des fichiers" onChange={(event) => { if (event.target.files) void uploadFiles(event.target.files); }} />
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-sm border bg-white p-2"><LiveSearch key={`${pathname}:${initialData.q}`} initialValue={initialData.q} loading={searchLoading} placeholder="Rechercher dans ce dossier…" onSearch={search} /><div className="ml-auto flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => openModal({ action: "create" })}><FolderPlus />Nouveau dossier</Button>{data.current && !data.q && <Button size="sm" disabled={isUploading} onClick={() => input.current?.click()}><Upload />Importer</Button>}<div className="flex border p-0.5" aria-label="Affichage"><Button variant="ghost" className={cn("size-7 p-0", view === "grid" && "bg-muted")} onClick={() => chooseView("grid")} aria-label="Vue grille" aria-pressed={view === "grid"}><LayoutGrid className="size-3.5" /></Button><Button variant="ghost" className={cn("size-7 p-0", view === "list" && "bg-muted")} onClick={() => chooseView("list")} aria-label="Vue liste" aria-pressed={view === "list"}><List className="size-3.5" /></Button></div></div></div>
    {data.q && <p className="mb-2 text-xs text-muted-foreground">Résultats dans tout le dossier pour « {data.q} »</p>}
    {(data.current || data.q) && <div className="mb-3 flex gap-5 border-b" aria-label="Filtrer les fichiers">{([{ value: "all", label: "Tous" }, { value: "images", label: "Images" }, { value: "documents", label: "Documents" }] as const).map((tab) => <Link key={tab.value} href={queryUrl({ type: tab.value })} aria-current={data.filter === tab.value ? "page" : undefined} className={cn("border-b-2 border-transparent pb-2 text-xs", data.filter === tab.value ? "border-primary font-medium text-primary" : "text-muted-foreground")}>{tab.label}<span className="ml-1.5 text-[11px] text-muted-foreground">{data.counts[tab.value]}</span></Link>)}</div>}
    {notice && <div role="status" className="mb-3 flex min-h-9 items-center justify-between border bg-muted px-3 text-xs">{notice}<Button variant="ghost" className="size-7 p-0" onClick={() => setNotice("")} aria-label="Masquer le message"><X className="size-3.5" /></Button></div>}
    {uploads.length > 0 && <section aria-label="Envois de fichiers" className="mb-3 border bg-white p-3"><div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-medium">{isUploading ? "Envoi en cours — gardez cette page ouverte" : "Envois terminés"}</h2>{!isUploading && <Button variant="ghost" className="size-7 p-0" onClick={() => setUploads([])} aria-label="Masquer les envois"><X className="size-3.5" /></Button>}</div><div className="max-h-40 space-y-2 overflow-y-auto" aria-live="polite">{uploads.map((item, index) => <div key={index} className="text-xs"><div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate">{item.name}</span>{item.status === "done" ? <Check className="size-3.5" /> : item.status === "error" ? <span className="text-destructive">Échec</span> : <span className="text-[11px] text-muted-foreground">{item.progress === 95 ? "Enregistrement…" : `${item.progress} %`}</span>}</div>{item.error ? <p className="mt-1 text-[11px] text-destructive">{item.error}</p> : <progress value={item.progress} max={100} className="mt-1 h-1 w-full accent-primary" aria-label={`Progression : ${item.name}`} />}</div>)}</div></section>}
    <div className={cn("min-h-48", dragging && "outline-2 outline-dashed outline-primary outline-offset-4")}>
      {dragging && data.current && <p className="mb-3 bg-muted p-4 text-center text-sm">Déposez vos fichiers dans ce dossier.</p>}
      {view === "grid" ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
        {data.folders.map((folder) => <article key={folder.id} className="relative rounded-sm border bg-white"><Link scroll={false} href={folderUrl(folder.id)} className="flex min-h-20 items-center gap-3 p-3 pr-9 hover:bg-muted/50"><FolderClosed className="size-7 shrink-0 fill-[#eeece3] text-[#8d8975]" strokeWidth={1} /><div className="min-w-0"><h2 className="line-clamp-2 text-sm font-medium">{folder.name}</h2><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{data.q ? folder.location : "Dossier"}</p></div></Link><div className="absolute right-1 top-1">{actions({ kind: "folder", id: folder.id, name: folder.name })}</div></article>)}
        {data.files.map((file) => <article key={file.id} className="relative overflow-hidden rounded-sm border bg-white"><button className="block w-full text-left" onClick={() => data.q ? router.push(folderUrl(file.folderId)) : setPreview(file)}><div className="flex h-28 items-center justify-center overflow-hidden border-b bg-muted">{file.storageProvider === "CLOUDINARY" ? <ArchiveImage src={`/api/files/${file.id}/content?thumbnail=1`} alt={file.displayName} className="size-full object-cover" /> : isVideoFile(file) ? <div className="relative flex size-full flex-col items-center justify-center gap-2 bg-[color-mix(in_srgb,var(--foreground)_88%,transparent)] text-white/85"><Film className="size-8" strokeWidth={1} /><span className="absolute inset-0 flex items-center justify-center"><span className="flex size-9 items-center justify-center rounded-full bg-white/20"><span className="ml-0.5 border-y-[7px] border-l-[11px] border-y-transparent border-l-white" /></span></span><span className="absolute bottom-2 text-[10px] uppercase tracking-widest text-white/70">{file.extension || "Vidéo"}</span></div> : <div className="flex flex-col items-center gap-2 text-muted-foreground"><FileText className="size-8" strokeWidth={1} /><span className="text-[10px] uppercase tracking-widest">{file.extension || "Fichier"}</span></div>}</div><div className="p-2.5 pr-9"><h2 className="truncate text-xs font-medium" title={file.displayName}>{file.displayName}</h2>{data.q && <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={file.location}>{file.location}</p>}<p className="mt-1 text-[11px] text-muted-foreground">{formatSize(file.size)}</p></div></button><div className="absolute right-1 bottom-1">{actions({ kind: "file", id: file.id, name: file.displayName })}</div></article>)}
      </div> : <div className="overflow-visible rounded-sm border bg-white"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Nom</th><th className="hidden min-w-52 px-3 py-2 font-medium sm:table-cell">Contenu</th><th className="hidden w-24 px-3 py-2 font-medium md:table-cell">Type</th>{showFileSize && <th className="hidden w-24 px-3 py-2 font-medium sm:table-cell">Taille</th>}<th className="hidden w-32 px-3 py-2 font-medium lg:table-cell">Modifié</th><th className="w-12 px-2 py-2 text-right font-medium"><span className="sr-only">Actions</span></th></tr></thead><tbody>
        {data.folders.map((folder) => <tr key={folder.id} className="group border-b transition-colors last:border-0 hover:bg-muted/45 focus-within:bg-muted/45"><td className="max-w-56 px-3 py-2.5"><Link scroll={false} href={folderUrl(folder.id)} className="flex items-center gap-2.5"><FolderClosed className="size-4 shrink-0 text-[#817d69]" /><span className="min-w-0"><span className="block truncate text-[13px] font-medium">{folder.name}</span>{data.q && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{folder.location}</span>}</span></Link></td><td className="hidden whitespace-nowrap px-3 text-xs text-muted-foreground sm:table-cell">{folder.documents} document{folder.documents > 1 ? "s" : ""} · {folder.subfolders} sous-dossier{folder.subfolders > 1 ? "s" : ""}</td><td className="hidden px-3 text-xs text-muted-foreground md:table-cell">Dossier</td>{showFileSize && <td className="hidden px-3 text-xs text-muted-foreground sm:table-cell">—</td>}<td className="hidden px-3 text-xs text-muted-foreground lg:table-cell">—</td><td className="px-1"><div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">{actions({ kind: "folder", id: folder.id, name: folder.name })}</div></td></tr>)}
        {data.files.map((file) => <tr key={file.id} className="group border-b transition-colors last:border-0 hover:bg-muted/45 focus-within:bg-muted/45"><td className="max-w-56 px-3 py-2.5"><button onClick={() => data.q ? router.push(folderUrl(file.folderId)) : setPreview(file)} className="flex max-w-full items-center gap-3 text-left" aria-label={data.q ? undefined : `Aperçu ${file.displayName}`}><DocumentFileGlyph file={file} /><span className="min-w-0"><span className="block truncate text-[13px]">{file.displayName}</span>{data.q && <span title={file.location} className="mt-0.5 block truncate text-[11px] text-muted-foreground">{file.location}</span>}</span></button></td><td className="hidden px-3 text-xs text-muted-foreground sm:table-cell">—</td><td className="hidden px-3 text-[11px] uppercase text-muted-foreground md:table-cell">{file.extension || "Fichier"}</td>{showFileSize && <td className="hidden whitespace-nowrap px-3 text-xs text-muted-foreground sm:table-cell">{formatSize(file.size)}</td>}<td className="hidden px-3 text-xs text-muted-foreground lg:table-cell">{new Date(file.createdAt).toLocaleDateString("fr-FR", { timeZone: "UTC" })}</td><td className="px-1"><div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">{actions({ kind: "file", id: file.id, name: file.displayName })}</div></td></tr>)}
      </tbody></table></div></div>}
      {!data.folders.length && !data.files.length && <div className="flex flex-col items-center border border-dashed px-5 py-10 text-center"><FolderClosed className="mb-3 size-7 text-muted-foreground" strokeWidth={1} /><h2 className="text-sm font-medium">{data.q ? `Aucun résultat pour « ${data.q} »` : data.filter !== "all" ? "Aucun fichier dans cette catégorie" : "Ce dossier est vide"}</h2><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{data.q ? "Essayez un autre nom de fichier ou de dossier." : data.current ? "Importez des fichiers ou glissez-les ici." : "Créez un dossier pour organiser les documents."}</p></div>}
    </div>
    {(data.current || data.q || data.filter !== "all" || data.pages > 1) && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-2 text-[11px] text-muted-foreground"><span>{data.folders.length} dossier{data.folders.length > 1 ? "s" : ""} · {data.counts[data.filter]} fichier{data.counts[data.filter] > 1 ? "s" : ""}</span>{data.pages > 1 ? <nav aria-label="Pagination" className="flex items-center gap-3">{data.page > 1 && <Link href={queryUrl({ page: data.page - 1 })}>Précédent</Link>}<span>{data.page} / {data.pages}</span>{data.page < data.pages && <Link href={queryUrl({ page: data.page + 1 })}>Suivant</Link>}</nav> : data.current && <span>Maximum {formatSize(data.maxBytes)} par fichier</span>}</div>}

    <Dialog open={!!modal} onOpenChange={(open) => { if (!open && !busy) setModal(null); }}><DialogContent><DialogTitle className="pr-8 text-xl font-medium">{modal?.action === "create" ? "Nouveau dossier" : modal?.action === "rename" ? "Renommer" : modal?.action === "move" ? "Déplacer le fichier" : modal?.action === "delete" && modal.target.kind === "file" ? "Supprimer ce document ?" : "Supprimer cet élément ?"}</DialogTitle><DialogDescription className="mt-3 break-words text-sm leading-6 text-muted-foreground">{modal?.action === "delete" ? modal.target.kind === "folder" ? `« ${modal.target.name} » sera supprimé uniquement s’il est vide.` : "Cette action supprimera le document de la plateforme." : modal?.action === "move" ? "Choisissez le dossier de destination dans ce dossier documentaire." : "Saisissez le nom à afficher dans la bibliothèque."}</DialogDescription>{modal?.action === "delete" && modal.target.kind === "file" ? <p className="mt-3 break-words rounded-sm border border-border bg-muted/40 px-3 py-2 text-sm font-medium">{modal.target.name}</p> : null}<form onSubmit={submit} className="mt-6 space-y-5">{(modal?.action === "create" || modal?.action === "rename") && <div><label htmlFor="element-name" className="mb-2 block text-sm">Nom</label><Input id="element-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={180} autoFocus /></div>}{modal?.action === "move" && <div><label htmlFor="destination" className="mb-2 block text-sm">Dossier de destination</label><select id="destination" required value={destination} onChange={(event) => setDestination(event.target.value)} className="h-11 w-full min-w-0 rounded-sm border bg-background px-3 text-sm"><option value="">Choisir un dossier</option>{data.allFolders.filter((folder) => folder.id !== data.files.find((file) => file.id === modal.target.id)?.folderId).map((folder) => <option key={folder.id} value={folder.id}>{folderTrail(folder.id, data.allFolders).map((f) => f.name).join(" / ")}</option>)}</select></div>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setModal(null)}>Annuler</Button><Button disabled={busy} variant={modal?.action === "delete" ? "destructive" : "default"}>{busy && <Loader2 className="animate-spin" />}{modal?.action === "delete" ? "Supprimer" : modal?.action === "move" ? "Déplacer" : "Enregistrer"}</Button></div></form></DialogContent></Dialog>
    {actionMenu()}
    <FilePreviewModal
      file={preview}
      files={data.q ? undefined : data.files}
      onClose={() => setPreview(null)}
      onNavigate={data.q ? undefined : setPreview}
    />
  </div>;
}

function ArchiveImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="p-5 text-center text-sm text-muted-foreground"><ImageIcon className="mx-auto mb-2 size-7" />Aperçu indisponible. Vous pouvez télécharger le fichier.</div>;
  // Authenticated byte proxy: Next image optimization must not cache private images publicly.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}
