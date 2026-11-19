import "server-only";
import Replicate from "replicate";
import { extFor, getStorage, mimeFor } from "./storage";
import { extractUrls, getModel, isMediaField, missingField, type MediaKind, type ModelDef, type ToolId, type Values } from "./models";
import { composePrompt, type PresetChoice } from "./presets";

export type Status = "starting" | "processing" | "succeeded" | "failed" | "canceled";

export interface Output { key: string; kind: MediaKind }

export interface Generation {
  id: string;
  tool: ToolId;
  modelId: string;
  modelName: string;
  /** What the user typed (prompt before presets). */
  prompt?: string;
  presets: PresetChoice;
  /** Form values; media fields hold storage keys. */
  values: Values;
  predictionId?: string;
  status: Status;
  outputs: Output[];
  error?: string;
  createdAt: string;
  completedAt?: string;
}

const metaKey = (id: string) => `meta/${id}.json`;

export async function saveGeneration(g: Generation) {
  await getStorage().put(metaKey(g.id), new TextEncoder().encode(JSON.stringify(g)), "application/json");
}

export async function loadGeneration(id: string): Promise<Generation | null> {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  const bytes = await getStorage().readBytes(metaKey(id));
  return bytes ? (JSON.parse(new TextDecoder().decode(bytes)) as Generation) : null;
}

// shortcut: reads every metadata file per listing; fine for one owner's few thousand items, add an index file if it gets slow.
export async function listGenerations(tool?: ToolId): Promise<Generation[]> {
  const keys = (await getStorage().list("meta/")).filter((k) => k.endsWith(".json"));
  const all = await Promise.all(keys.map((k) => loadGeneration(k.slice(5, -5))));
  return all
    .filter((g): g is Generation => !!g && (!tool || g.tool === tool))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteGeneration(g: Generation) {
  const s = getStorage();
  await Promise.all(g.outputs.map((o) => s.delete(o.key)));
  await s.delete(metaKey(g.id));
}

function replicate() {
  const auth = process.env.REPLICATE_API_TOKEN;
  if (!auth) throw new Error("REPLICATE_API_TOKEN is not set");
  return new Replicate({ auth });
}

/** Media inputs: a presigned URL when storage is public-reachable (R2), else the raw bytes (the client uploads them to Replicate). */
async function resolveMedia(key: string): Promise<string | Blob> {
  if (!key.startsWith("uploads/") && !key.startsWith("outputs/")) throw new Error("Media must come from your uploads or library");
  const s = getStorage();
  if (s.presignGet) return s.presignGet(key);
  const bytes = await s.readBytes(key);
  if (!bytes) throw new Error(`Missing media: ${key}`);
  return new Blob([bytes as BlobPart], { type: mimeFor(key) });
}

export async function buildInput(model: ModelDef, values: Values, presets: PresetChoice) {
  const missing = missingField(model, values);
  if (missing) throw new Error(`${missing} is required`);
  const resolved: Values = { ...values };
  for (const f of model.fields) {
    if (isMediaField(f) && typeof values[f.name] === "string" && values[f.name]) resolved[f.name] = await resolveMedia(values[f.name] as string);
  }
  const allowed = Object.fromEntries(Object.entries(presets).filter(([k]) => model.presets?.includes(k as keyof PresetChoice)));
  if (typeof values.prompt === "string") resolved.prompt = composePrompt(values.prompt, allowed);
  return model.build(resolved);
}

export async function startGeneration(modelId: string, values: Values, presets: PresetChoice = {}): Promise<Generation> {
  const model = getModel(modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);
  const input = await buildInput(model, values, presets);

  const r = replicate();
  let prediction;
  if (model.official) {
    prediction = await r.predictions.create({ model: model.ref, input });
  } else {
    const [owner, name] = model.ref.split("/");
    const version = (await r.models.get(owner, name)).latest_version?.id;
    if (!version) throw new Error(`No runnable version for ${model.ref}`);
    prediction = await r.predictions.create({ version, input });
  }

  const g: Generation = {
    id: crypto.randomUUID(),
    tool: model.tool,
    modelId: model.id,
    modelName: model.name,
    prompt: typeof values.prompt === "string" ? values.prompt : undefined,
    presets,
    values,
    predictionId: prediction.id,
    status: prediction.status === "failed" ? "failed" : "processing",
    outputs: [],
    error: prediction.error ? String(prediction.error) : undefined,
    createdAt: new Date().toISOString(),
  };
  await saveGeneration(g);
  return g;
}

function kindOf(contentType: string, url: string): MediaKind {
  const t = contentType.startsWith("application/octet-stream") ? mimeFor(new URL(url).pathname) : contentType;
  return t.startsWith("video/") ? "video" : t.startsWith("audio/") ? "audio" : "image";
}

/** Checks Replicate; on success copies the outputs into our storage (Replicate's URLs expire). */
export async function refreshGeneration(g: Generation): Promise<Generation> {
  if (g.status !== "processing" && g.status !== "starting") return g;
  if (!g.predictionId) return g;
  const p = await replicate().predictions.get(g.predictionId);

  if (p.status === "succeeded") {
    const urls = extractUrls(p.output);
    if (!urls.length) return finish(g, "failed", "The model returned no media");
    const outputs: Output[] = [];
    for (const [i, url] of urls.entries()) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Could not download output (${res.status})`);
      const contentType = res.headers.get("content-type") || mimeFor(new URL(url).pathname);
      const ext = contentType.startsWith("application/octet-stream") ? new URL(url).pathname.split(".").pop() || "bin" : extFor(contentType);
      const key = `outputs/${g.id}/${i}.${ext}`;
      await getStorage().put(key, new Uint8Array(await res.arrayBuffer()), mimeFor(key));
      outputs.push({ key, kind: kindOf(contentType, url) });
    }
    g.outputs = outputs;
    return finish(g, "succeeded");
  }
  if (p.status === "failed" || p.status === "canceled") return finish(g, p.status, p.error ? String(p.error) : undefined);
  return g;
}

async function finish(g: Generation, status: Status, error?: string) {
  g.status = status;
  g.error = error;
  g.completedAt = new Date().toISOString();
  await saveGeneration(g);
  return g;
}
