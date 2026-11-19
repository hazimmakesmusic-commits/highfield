"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { defaultValues, isFree, isMediaField, missingField, modelsFor, needsFor, TOOLS, type EnvKey, type MediaKind, type ModelDef, type ToolId, type Values } from "@/lib/models";
import { CAMERA_PRESETS, EFFECT_PRESETS, STYLE_PRESETS, type Preset, type PresetChoice, type PresetKind } from "@/lib/presets";
import { useGenerations } from "@/hooks/use-generations";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { MediaInput } from "@/components/media-input";
import { GenerationGrid } from "@/components/generation-card";
import { cn } from "@/lib/utils";

const PRESET_SETS: Record<PresetKind, { title: string; list: Preset[] }> = {
  style: { title: "Style", list: STYLE_PRESETS },
  camera: { title: "Camera move", list: CAMERA_PRESETS },
  effect: { title: "Effect", list: EFFECT_PRESETS },
};
const KINDS: MediaKind[] = ["image", "video", "audio"];

/** Picks the model and prefilled media from links like /video?image=uploads/x.png. */
function initialState(tool: ToolId, params: URLSearchParams): { model: ModelDef; values: Values } {
  const models = modelsFor(tool);
  const media = KINDS.filter((k) => params.get(k));
  const model =
    models.find((m) => m.id === params.get("model")) ??
    models.find((m) => media.every((k) => m.fields.some((f) => f.type === k))) ??
    models[0];
  const values = defaultValues(model);
  for (const k of media) {
    const f = model.fields.find((f) => f.type === k);
    if (f) values[f.name] = params.get(k)!;
  }
  return { model, values };
}

type Config = { keys: Record<EnvKey, boolean>; cloudStorage: boolean };

const NEED_LABEL: Record<EnvKey, string> = {
  POLLINATIONS_API_KEY: "Needs a free Pollinations key",
  HF_TOKEN: "Needs a free Hugging Face token",
  REPLICATE_API_TOKEN: "Paid: needs a Replicate key",
};

export function Studio({ tool }: { tool: ToolId }) {
  const params = useSearchParams();
  const init = useMemo(() => initialState(tool, new URLSearchParams(params.toString())), [tool, params]);
  const [model, setModel] = useState(init.model);
  const [values, setValues] = useState<Values>(init.values);
  const [presets, setPresets] = useState<PresetChoice>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { items, loading, error: listError, add, remove } = useGenerations(tool);
  const info = TOOLS.find((t) => t.id === tool)!;
  const [config, setConfig] = useState<Config | null>(null);
  const missingKey = (m: ModelDef) => { const n = needsFor(m); return n && config && !config.keys[n] ? n : null; };

  useEffect(() => { fetch("/api/config").then((r) => r.json()).then(setConfig).catch(() => {}); }, []);

  // Once we know which keys are set, move off a model that can't run here.
  useEffect(() => {
    if (!config || !missingKey(model)) return;
    const usable = modelsFor(tool).filter((m) => !missingKey(m));
    const media = model.fields.filter((f) => isMediaField(f) && values[f.name]).map((f) => f.type);
    const pick = usable.find((m) => media.every((t) => m.fields.some((f) => f.type === t))) ?? usable[0];
    if (pick) chooseModel(pick);
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  function chooseModel(m: ModelDef) {
    // Keep the prompt and any media that fits the new model.
    const next = defaultValues(m);
    for (const f of m.fields) {
      if (f.type === "prompt" && values.prompt) next.prompt = values.prompt;
      if (isMediaField(f)) {
        const prev = model.fields.find((p) => p.type === f.type && values[p.name]);
        if (prev) next[f.name] = values[prev.name];
      }
    }
    setModel(m); setValues(next); setError(null);
  }

  const set = (name: string, v: unknown) => setValues((cur) => ({ ...cur, [name]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing = missingField(model, values);
    if (missing) return setError(`${missing} is required`);
    setSubmitting(true); setError(null);
    try {
      const res = await fetch("/api/generations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: model.id, values, presets }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      add(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <form onSubmit={submit} className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <div>
          <h1 className="text-2xl font-semibold">{info.label}</h1>
          <p className="text-sm text-muted-foreground">{info.blurb}</p>
        </div>

        <div className="space-y-2">
          <Label>Model</Label>
          <div className="grid gap-2">
            {modelsFor(tool).map((m) => {
              const missing = missingKey(m);
              return (
                <button key={m.id} type="button" onClick={() => chooseModel(m)} disabled={!!missing}
                  title={missing ? `${NEED_LABEL[missing]} (${missing}). See the README.` : undefined}
                  className={cn("rounded-lg border p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45",
                    m.id === model.id && "border-primary bg-primary/10")}>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {m.name}
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      isFree(m) ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground")}>
                      {isFree(m) ? "Free" : "Paid"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{m.blurb}</p>
                  {missing && <p className="mt-1 text-xs text-primary">{NEED_LABEL[missing]}</p>}
                </button>
              );
            })}
          </div>
          {model.limits && <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">{model.limits}</p>}
        </div>

        {model.fields.map((f) => (
          <div key={`${model.id}-${f.name}`} className="space-y-2">
            <Label htmlFor={f.name}>{f.label}{f.required && <span className="text-primary"> *</span>}</Label>
            {f.type === "prompt" && (
              <Textarea id={f.name} value={(values[f.name] as string) ?? ""} onChange={(e) => set(f.name, e.target.value)}
                placeholder="Describe the shot: subject, setting, light, mood…" />
            )}
            {f.type === "text" && <Input id={f.name} value={(values[f.name] as string) ?? ""} onChange={(e) => set(f.name, e.target.value)} />}
            {f.type === "select" && (
              <Select id={f.name} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)}>
                {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            )}
            {f.type === "toggle" && (
              <label className="flex items-center gap-2 text-sm">
                <input id={f.name} type="checkbox" className="size-4 accent-[var(--primary)]" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} /> On
              </label>
            )}
            {isMediaField(f) && <MediaInput kind={f.type as MediaKind} value={values[f.name] as string | undefined} onChange={(k) => set(f.name, k)} />}
            {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
          </div>
        ))}

        {model.presets?.map((kind) => (
          <div key={kind} className="space-y-2">
            <Label>{PRESET_SETS[kind].title}</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_SETS[kind].list.map((p) => (
                <button key={p.id} type="button" title={p.prompt}
                  onClick={() => setPresets((cur) => ({ ...cur, [kind]: cur[kind] === p.id ? undefined : p.id }))}
                  className={cn("rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted",
                    presets[kind] === p.id && "border-primary bg-primary/15 text-primary")}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {error && <p className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate
        </Button>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Recent {info.label.toLowerCase()} generations</h2>
        {listError && <p className="text-sm text-destructive">{listError}</p>}
        {loading ? <Loader2 className="animate-spin text-muted-foreground" /> :
          <GenerationGrid items={items} onDelete={remove} empty="Nothing here yet. Your results will appear here and stay in your library." />}
      </section>
    </div>
  );
}
