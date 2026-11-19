"use client";
import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import type { MediaKind } from "@/lib/models";
import { Button } from "@/components/ui/button";

export const mediaUrl = (key: string) => `/api/media/${key}`;

export function MediaPreview({ kind, src, className }: { kind: MediaKind; src: string; className?: string }) {
  if (kind === "video") return <video src={src} className={className} controls playsInline loop />;
  if (kind === "audio") return <audio src={src} className="w-full" controls />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={className} />;
}

async function upload(file: File): Promise<string> {
  const sign = await fetch("/api/uploads", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType: file.type }),
  });
  const body = await sign.json();
  if (!sign.ok) throw new Error(body.error);
  const put = await fetch(body.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return body.key;
}

/** File picker that uploads to storage and hands back the storage key. */
export function MediaInput({ kind, value, onChange }: { kind: MediaKind; value?: string; onChange: (key: string | undefined) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true); setError(null);
    try { onChange(await upload(file)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div
      className="relative rounded-lg border border-dashed border-input bg-card/50"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
    >
      {value ? (
        <div className="relative p-2">
          <MediaPreview kind={kind} src={mediaUrl(value)} className="max-h-56 w-full rounded-md object-contain" />
          <Button type="button" size="icon" variant="secondary" className="absolute right-3 top-3" onClick={() => onChange(undefined)} aria-label="Remove">
            <X />
          </Button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={busy}
          className="flex w-full flex-col items-center gap-2 px-4 py-6 text-sm text-muted-foreground hover:text-foreground">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
          {busy ? "Uploading…" : `Drop or choose ${kind === "audio" ? "an audio file" : `a ${kind}`}`}
        </button>
      )}
      <input ref={ref} type="file" hidden accept={`${kind}/*`} onChange={(e) => pick(e.target.files?.[0])} />
      {error && <p className="px-3 pb-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
