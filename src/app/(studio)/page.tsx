import Link from "next/link";
import { Film, Image as ImageIcon, Maximize2, Mic } from "lucide-react";
import { TOOLS, modelsFor } from "@/lib/models";

const ICONS = { image: ImageIcon, video: Film, lipsync: Mic, upscale: Maximize2 };

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-2 pt-4">
        <h1 className="text-4xl font-semibold tracking-tight">What are we making <span className="ember-text">today?</span></h1>
        <p className="text-muted-foreground">Cover art, music videos, visualizers and promo clips. Everything you make is kept in your library.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map((t) => {
          const Icon = ICONS[t.id];
          return (
            <Link key={t.id} href={`/${t.id}`} className="group rounded-xl border bg-card p-6 transition-colors hover:border-primary">
              <Icon className="mb-4 size-6 text-primary" />
              <h2 className="text-lg font-medium">{t.label}</h2>
              <p className="text-sm text-muted-foreground">{t.blurb}</p>
              <p className="mt-3 text-xs text-muted-foreground">{modelsFor(t.id).map((m) => m.name).join(" · ")}</p>
            </Link>
          );
        })}
      </div>
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        <p className="mb-2 font-medium text-foreground">A typical music-video flow</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Make a key frame in <Link className="text-primary" href="/image">Image</Link> (try the Cinematic or Album cover style).</li>
          <li>Hit <b>Animate</b> on it and pick a camera move or effect in <Link className="text-primary" href="/video">Video</Link>.</li>
          <li>Send a portrait and your vocals to <Link className="text-primary" href="/lipsync">Lip Sync</Link> for performance shots.</li>
          <li><Link className="text-primary" href="/upscale">Upscale</Link> the keepers to 4K and download them from your <Link className="text-primary" href="/library">Library</Link>.</li>
        </ol>
      </div>
    </div>
  );
}
