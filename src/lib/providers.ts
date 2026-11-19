import "server-only";
import type { ModelDef } from "./models";

// Free providers. Both are real services; nothing here fakes a result.

export type FileData = { path: string; meta: { _type: "gradio.FileData" }; orig_name?: string };

// ---------- Pollinations (images) ----------

const POLLINATIONS = "https://gen.pollinations.ai/image/";
/** The older keyless endpoint: no account needed, serves its own default model with a watermark. */
const POLLINATIONS_KEYLESS = "https://image.pollinations.ai/prompt/";

function authHeader(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function errorText(res: Response) {
  const body = await res.text();
  try { return JSON.parse(body)?.error?.message ?? body; } catch { return body.slice(0, 300); }
}

/** Generates one image synchronously and returns its bytes. */
export async function pollinationsImage(input: Record<string, unknown>): Promise<{ bytes: Uint8Array; contentType: string }> {
  const { prompt, model, ...rest } = input;
  const keyless = model === "sana";
  const q = new URLSearchParams({ seed: String(Math.floor(Math.random() * 2 ** 31)) });
  for (const [k, v] of Object.entries(rest)) q.set(k, String(v));
  if (keyless) q.set("nologo", "true");
  else q.set("model", String(model));
  const res = await fetch(`${keyless ? POLLINATIONS_KEYLESS : POLLINATIONS}${encodeURIComponent(String(prompt))}?${q}`, {
    headers: keyless ? {} : authHeader(process.env.POLLINATIONS_API_KEY),
    signal: AbortSignal.timeout(110_000),
  });
  if (!res.ok) {
    const msg = await errorText(res);
    if (res.status === 401) throw new Error(`Pollinations needs a free API key for this model (POLLINATIONS_API_KEY). ${msg}`);
    if (res.status === 402) throw new Error(`Your free Pollinations balance is used up for now. ${msg}`);
    if (res.status === 429) throw new Error("Pollinations is rate-limiting requests. Wait a minute and try again.");
    throw new Error(`Pollinations error ${res.status}: ${msg}`);
  }
  return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") || "image/jpeg" };
}

// ---------- Hugging Face Spaces (Gradio REST API) ----------

const spaceBase = (m: ModelDef) => `https://${m.space!.host}${m.space!.prefix}`;
const hfHeaders = () => authHeader(process.env.HF_TOKEN);

export const HF_GENERIC_ERROR =
  "The free Hugging Face Space returned an error. Usually your 5 free GPU minutes for today are used up, or the Space is busy or restarting. Try again later, or use a shorter clip.";

/** Uploads a file to the Space so it can be passed as an input. */
export async function hfUpload(m: ModelDef, bytes: Uint8Array, name: string, type: string): Promise<FileData> {
  const form = new FormData();
  form.append("files", new Blob([bytes as BlobPart], { type }), name);
  const res = await fetch(`${spaceBase(m)}/upload`, { method: "POST", body: form, headers: hfHeaders() });
  if (!res.ok) throw new Error(`Could not upload to ${m.ref} (${res.status}). The Space may be down.`);
  const [path] = (await res.json()) as string[];
  return { path, meta: { _type: "gradio.FileData" }, orig_name: name };
}

/** Queues a job and returns its event id. */
export async function hfStart(m: ModelDef, api: string, data: unknown[]): Promise<string> {
  const res = await fetch(`${spaceBase(m)}/call${api}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...hfHeaders() },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`${m.ref} refused the job (${res.status}): ${await errorText(res)}`);
  return (await res.json()).event_id;
}

export type HfResult = { done: false } | { done: true; data: unknown } | { done: true; error: string };

/** Parses a Gradio event stream body. Exported for tests. */
export function parseGradioStream(text: string): HfResult {
  let last: HfResult = { done: false };
  for (const block of text.split(/\n\n/)) {
    const event = block.match(/^event: (\w+)/m)?.[1];
    const raw = block.match(/^data: (.*)$/m)?.[1];
    if (event === "complete") last = { done: true, data: raw ? JSON.parse(raw) : null };
    if (event === "error") {
      let msg: unknown = null;
      try { msg = raw ? JSON.parse(raw) : null; } catch { msg = raw; }
      last = { done: true, error: typeof msg === "string" && msg ? `${msg}` : HF_GENERIC_ERROR };
    }
  }
  return last;
}

/**
 * Listens for the job's result for up to `waitMs`. Gradio keeps a finished result until one listener reads it,
 * so if we time out we simply listen again on the next poll.
 */
export async function hfPoll(m: ModelDef, api: string, eventId: string, waitMs = 45_000): Promise<HfResult> {
  let res: Response;
  try {
    res = await fetch(`${spaceBase(m)}/call${api}/${eventId}`, { headers: hfHeaders(), signal: AbortSignal.timeout(waitMs) });
    if (res.status === 404) return { done: true, error: "The Space lost this job (it may have restarted). Please try again." };
    if (!res.ok) return { done: false };
    return parseGradioStream(await res.text());
  } catch (e) {
    if ((e as Error).name === "TimeoutError" || (e as Error).name === "AbortError") return { done: false };
    throw e;
  }
}

export async function hfDownload(url: string): Promise<Response> {
  return fetch(url, { headers: hfHeaders() });
}
