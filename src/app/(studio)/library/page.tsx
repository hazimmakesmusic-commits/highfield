"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { TOOLS, type ToolId } from "@/lib/models";
import { useGenerations } from "@/hooks/use-generations";
import { GenerationGrid } from "@/components/generation-card";
import { cn } from "@/lib/utils";

export default function LibraryPage() {
  const [tool, setTool] = useState<ToolId | undefined>();
  const [status, setStatus] = useState<"all" | "done" | "failed">("all");
  const { items, loading, error, remove } = useGenerations();
  const shown = items.filter((g) => (!tool || g.tool === tool) &&
    (status === "all" || (status === "done" ? g.status === "succeeded" : g.status === "failed" || g.status === "canceled")));
  const chip = (active: boolean) => cn("rounded-full border px-3 py-1 text-xs hover:bg-muted", active && "border-primary bg-primary/15 text-primary");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="text-sm text-muted-foreground">Everything you&apos;ve generated, saved to your storage.</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button className={chip(!tool)} onClick={() => setTool(undefined)}>All</button>
        {TOOLS.map((t) => <button key={t.id} className={chip(tool === t.id)} onClick={() => setTool(t.id)}>{t.label}</button>)}
        <span className="mx-2 w-px bg-border" />
        {(["all", "done", "failed"] as const).map((s) => <button key={s} className={chip(status === s)} onClick={() => setStatus(s)}>{s}</button>)}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? <Loader2 className="animate-spin text-muted-foreground" /> :
        <GenerationGrid items={shown} onDelete={remove} empty="No generations match." />}
    </div>
  );
}
