"use client";
import Link from "next/link";
import { AlertTriangle, Download, Film, Loader2, Maximize2, Mic, Pencil, Trash2 } from "lucide-react";
import type { Generation } from "@/lib/generations";
import { Button } from "@/components/ui/button";
import { MediaPreview, mediaUrl } from "@/components/media-input";

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Actions that send an output into another tool. */
function sendTo(kind: string, key: string) {
  const q = (o: Record<string, string>) => `?${new URLSearchParams(o)}`;
  if (kind === "image") return [
    { label: "Animate", icon: Film, href: `/video${q({ image: key })}` },
    { label: "Edit", icon: Pencil, href: `/image${q({ model: "flux-kontext", image: key })}` },
    { label: "Lip sync", icon: Mic, href: `/lipsync${q({ model: "omni-human", image: key })}` },
    { label: "Upscale", icon: Maximize2, href: `/upscale${q({ model: "topaz-image", image: key })}` },
  ];
  if (kind === "video") return [
    { label: "Lip sync", icon: Mic, href: `/lipsync${q({ model: "lipsync-2", video: key })}` },
    { label: "Upscale", icon: Maximize2, href: `/upscale${q({ model: "topaz-video", video: key })}` },
  ];
  return [];
}

export function GenerationCard({ g, onDelete }: { g: Generation; onDelete: (id: string) => void }) {
  const busy = g.status === "processing" || g.status === "starting";
  return (
    <div className="overflow-hidden rounded-lg border bg-card" data-testid="generation">
      {busy && (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" /> Generating with {g.modelName}…
        </div>
      )}
      {(g.status === "failed" || g.status === "canceled") && (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-muted p-4 text-center text-sm text-destructive">
          <AlertTriangle className="size-6" /> {g.error || `Generation ${g.status}`}
        </div>
      )}
      {!busy && g.error && g.status !== "failed" && g.status !== "canceled" && <p className="p-2 text-xs text-destructive">{g.error}</p>}
      {g.outputs.map((o) => (
        <div key={o.key} className="group relative border-b last:border-b-0">
          <MediaPreview kind={o.kind} src={mediaUrl(o.key)} className="w-full bg-black object-contain" />
          <div className="flex flex-wrap gap-1 p-2">
            {sendTo(o.kind, o.key).map((a) => (
              <Button key={a.label} asChild size="sm" variant="secondary"><Link href={a.href}><a.icon />{a.label}</Link></Button>
            ))}
            <Button asChild size="sm" variant="ghost"><a href={`${mediaUrl(o.key)}?download`} aria-label="Download"><Download /></a></Button>
          </div>
        </div>
      ))}
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{g.modelName}</p>
          {g.prompt && <p className="line-clamp-2 text-xs text-muted-foreground" title={g.prompt}>{g.prompt}</p>}
          <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(g.createdAt)}</p>
        </div>
        <Button size="icon" variant="ghost" onClick={() => confirm("Delete this from your library?") && onDelete(g.id)} aria-label="Delete">
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

export function GenerationGrid({ items, onDelete, empty }: { items: Generation[]; onDelete: (id: string) => void; empty: string }) {
  if (!items.length) return <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
      {items.map((g) => <GenerationCard key={g.id} g={g} onDelete={onDelete} />)}
    </div>
  );
}
