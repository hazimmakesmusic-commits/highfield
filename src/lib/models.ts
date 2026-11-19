// The model catalogue. Every tool page, form field and Replicate input mapping comes from here.
// Input names follow each model's Replicate API schema.
import type { PresetKind } from "./presets";

export type ToolId = "image" | "video" | "lipsync" | "upscale";
export type MediaKind = "image" | "video" | "audio";
export type FieldType = "prompt" | "text" | "select" | "toggle" | MediaKind;
export type Values = Record<string, unknown>;

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  default?: string | boolean;
  help?: string;
}

export interface ModelDef {
  id: string;
  name: string;
  /** Replicate "owner/name". */
  ref: string;
  /** Official models run via the model endpoint; others resolve their latest version first. */
  official: boolean;
  tool: ToolId;
  blurb: string;
  fields: Field[];
  presets?: PresetKind[];
  build(v: Values): Record<string, unknown>;
}

export const TOOLS: { id: ToolId; label: string; blurb: string }[] = [
  { id: "image", label: "Image", blurb: "Stills, album art, key frames and edits" },
  { id: "video", label: "Video", blurb: "Animate images with camera moves and effects" },
  { id: "lipsync", label: "Lip Sync", blurb: "Talking avatars and synced performances" },
  { id: "upscale", label: "Upscale", blurb: "Sharpen images and videos up to 4K" },
];

const prompt: Field = { name: "prompt", label: "Prompt", type: "prompt", required: true };
const ar = (options: string[], def = options[0]): Field => ({ name: "aspect_ratio", label: "Aspect ratio", type: "select", options, default: def });
const FLUX_AR = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9", "9:21"];

/** Drops undefined/empty values so optional inputs are not sent. */
function clean(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}
const int = (v: unknown) => (v === undefined || v === "" ? undefined : parseInt(String(v), 10));

export const MODELS: ModelDef[] = [
  // ---------- Image ----------
  {
    id: "flux-ultra", name: "FLUX 1.1 Pro Ultra", ref: "black-forest-labs/flux-1.1-pro-ultra", official: true, tool: "image",
    blurb: "Top-quality photoreal stills up to 4MP",
    presets: ["style"],
    fields: [prompt, ar(FLUX_AR), { name: "raw", label: "Raw (more natural, less polished)", type: "toggle", default: false },
      { name: "image_prompt", label: "Reference image (optional)", type: "image" }],
    build: (v) => clean({ prompt: v.prompt, aspect_ratio: v.aspect_ratio, raw: !!v.raw, image_prompt: v.image_prompt, output_format: "png", safety_tolerance: 2 }),
  },
  {
    id: "flux-schnell", name: "FLUX Schnell", ref: "black-forest-labs/flux-schnell", official: true, tool: "image",
    blurb: "Fast, cheap drafts, up to 4 at once",
    presets: ["style"],
    fields: [prompt, ar(FLUX_AR), { name: "num_outputs", label: "Images", type: "select", options: ["1", "2", "3", "4"], default: "4" }],
    build: (v) => clean({ prompt: v.prompt, aspect_ratio: v.aspect_ratio, num_outputs: int(v.num_outputs), output_format: "png" }),
  },
  {
    id: "ideogram-v3", name: "Ideogram v3 Turbo", ref: "ideogram-ai/ideogram-v3-turbo", official: true, tool: "image",
    blurb: "Best for lettering: covers, posters, titles",
    presets: ["style"],
    fields: [prompt, ar(["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"])],
    build: (v) => clean({ prompt: v.prompt, aspect_ratio: v.aspect_ratio }),
  },
  {
    id: "imagen-4", name: "Imagen 4", ref: "google/imagen-4", official: true, tool: "image",
    blurb: "Crisp detail and strong prompt following",
    presets: ["style"],
    fields: [prompt, ar(["1:1", "16:9", "9:16", "4:3", "3:4"])],
    build: (v) => clean({ prompt: v.prompt, aspect_ratio: v.aspect_ratio, output_format: "png" }),
  },
  {
    id: "flux-kontext", name: "FLUX Kontext Pro (edit)", ref: "black-forest-labs/flux-kontext-pro", official: true, tool: "image",
    blurb: "Edit an image with words: restyle, relight, change outfits",
    presets: ["style"],
    fields: [{ ...prompt, label: "What to change" }, { name: "input_image", label: "Image to edit", type: "image", required: true },
      ar(["match_input_image", ...FLUX_AR])],
    build: (v) => clean({ prompt: v.prompt, input_image: v.input_image, aspect_ratio: v.aspect_ratio, output_format: "png" }),
  },

  // ---------- Video ----------
  {
    id: "kling-2.1", name: "Kling 2.1", ref: "kwaivgi/kling-v2.1", official: true, tool: "video",
    blurb: "Image-to-video with strong motion and faces",
    presets: ["camera", "effect"],
    fields: [{ name: "start_image", label: "Start frame", type: "image", required: true }, prompt,
      { name: "mode", label: "Quality", type: "select", options: ["standard", "pro"], default: "pro", help: "pro renders 1080p" },
      { name: "duration", label: "Seconds", type: "select", options: ["5", "10"], default: "5" },
      { name: "negative_prompt", label: "Avoid (optional)", type: "text" }],
    build: (v) => clean({ prompt: v.prompt, start_image: v.start_image, mode: v.mode, duration: int(v.duration), negative_prompt: v.negative_prompt }),
  },
  {
    id: "hailuo-02", name: "Hailuo 02", ref: "minimax/hailuo-02", official: true, tool: "video",
    blurb: "Physics-heavy action; image or text to video",
    presets: ["camera", "effect"],
    fields: [prompt, { name: "first_frame_image", label: "Start frame (optional)", type: "image" },
      { name: "duration", label: "Seconds", type: "select", options: ["6", "10"], default: "6" },
      { name: "resolution", label: "Resolution", type: "select", options: ["768p", "1080p"], default: "1080p", help: "1080p is 6s only" }],
    build: (v) => clean({ prompt: v.prompt, first_frame_image: v.first_frame_image, duration: int(v.duration), resolution: v.resolution, prompt_optimizer: false }),
  },
  {
    id: "seedance-pro", name: "Seedance 1 Pro", ref: "bytedance/seedance-1-pro", official: true, tool: "video",
    blurb: "Cinematic multi-shot clips at 1080p",
    presets: ["camera", "effect"],
    fields: [prompt, { name: "image", label: "Start frame (optional)", type: "image" },
      { name: "duration", label: "Seconds", type: "select", options: ["5", "10"], default: "5" },
      { name: "resolution", label: "Resolution", type: "select", options: ["1080p", "480p"], default: "1080p" },
      ar(["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], "16:9"),
      { name: "camera_fixed", label: "Lock camera", type: "toggle", default: false }],
    build: (v) => clean({ prompt: v.prompt, image: v.image, duration: int(v.duration), resolution: v.resolution, aspect_ratio: v.aspect_ratio, camera_fixed: !!v.camera_fixed }),
  },
  {
    id: "wan-2.2-fast", name: "Wan 2.2 Fast", ref: "wan-video/wan-2.2-i2v-fast", official: true, tool: "video",
    blurb: "Quick, low-cost image-to-video drafts",
    presets: ["camera", "effect"],
    fields: [{ name: "image", label: "Start frame", type: "image", required: true }, prompt],
    build: (v) => clean({ prompt: v.prompt, image: v.image }),
  },
  {
    id: "veo-3-fast", name: "Veo 3 Fast", ref: "google/veo-3-fast", official: true, tool: "video",
    blurb: "Text-to-video with native sound and dialogue",
    presets: ["camera", "effect"],
    fields: [prompt],
    build: (v) => clean({ prompt: v.prompt }),
  },

  // ---------- Lip sync ----------
  {
    id: "omni-human", name: "OmniHuman", ref: "bytedance/omni-human", official: true, tool: "lipsync",
    blurb: "Photo + vocals → a performing, singing avatar",
    fields: [{ name: "image", label: "Portrait", type: "image", required: true },
      { name: "audio", label: "Vocals or speech", type: "audio", required: true, help: "Keep it under ~30s; isolated vocals sync best" }],
    build: (v) => clean({ image: v.image, audio: v.audio }),
  },
  {
    id: "lipsync-2", name: "Lipsync 2", ref: "sync/lipsync-2", official: true, tool: "lipsync",
    blurb: "Re-sync the mouth of an existing video to new audio",
    fields: [{ name: "video", label: "Video", type: "video", required: true },
      { name: "audio", label: "Audio", type: "audio", required: true },
      { name: "sync_mode", label: "If lengths differ", type: "select", options: ["loop", "bounce", "cut_off", "silence", "remap"], default: "cut_off" }],
    build: (v) => clean({ video: v.video, audio: v.audio, sync_mode: v.sync_mode }),
  },

  // ---------- Upscale ----------
  {
    id: "topaz-image", name: "Topaz Image Upscale", ref: "topazlabs/image-upscale", official: true, tool: "upscale",
    blurb: "Pro-grade image upscaling and enhancement",
    fields: [{ name: "image", label: "Image", type: "image", required: true },
      { name: "upscale_factor", label: "Scale", type: "select", options: ["2x", "4x", "6x"], default: "2x" },
      { name: "enhance_model", label: "Enhancer", type: "select", options: ["Standard V2", "Low Resolution V2", "CGI", "High Fidelity V2", "Text Refine"], default: "Standard V2" }],
    build: (v) => clean({ image: v.image, upscale_factor: v.upscale_factor, enhance_model: v.enhance_model, output_format: "png" }),
  },
  {
    id: "real-esrgan", name: "Real-ESRGAN", ref: "nightmareai/real-esrgan", official: false, tool: "upscale",
    blurb: "Cheap image upscaling with optional face fix",
    fields: [{ name: "image", label: "Image", type: "image", required: true },
      { name: "scale", label: "Scale", type: "select", options: ["2", "4"], default: "4" },
      { name: "face_enhance", label: "Fix faces", type: "toggle", default: false }],
    build: (v) => clean({ image: v.image, scale: int(v.scale), face_enhance: !!v.face_enhance }),
  },
  {
    id: "topaz-video", name: "Topaz Video Upscale", ref: "topazlabs/video-upscale", official: true, tool: "upscale",
    blurb: "Upscale and smooth videos to 1080p or 4K",
    fields: [{ name: "video", label: "Video", type: "video", required: true },
      { name: "target_resolution", label: "Resolution", type: "select", options: ["1080p", "4k", "720p"], default: "1080p" },
      { name: "target_fps", label: "Frame rate", type: "select", options: ["30", "60", "24"], default: "30" }],
    build: (v) => clean({ video: v.video, target_resolution: v.target_resolution, target_fps: int(v.target_fps) }),
  },
];

export function getModel(id: string): ModelDef | undefined {
  return MODELS.find((m) => m.id === id);
}

export function modelsFor(tool: ToolId): ModelDef[] {
  return MODELS.filter((m) => m.tool === tool);
}

export const isMediaField = (f: Field) => f.type === "image" || f.type === "video" || f.type === "audio";

export function defaultValues(m: ModelDef): Values {
  return Object.fromEntries(m.fields.filter((f) => f.default !== undefined).map((f) => [f.name, f.default]));
}

/** Returns the label of the first required field that is empty, or null. */
export function missingField(m: ModelDef, v: Values): string | null {
  const f = m.fields.find((f) => f.required && (v[f.name] === undefined || v[f.name] === null || String(v[f.name]).trim() === ""));
  return f ? f.label : null;
}

/** Collects every URL in a Replicate output (string, array, or nested object). */
export function extractUrls(output: unknown): string[] {
  if (typeof output === "string") return /^https?:\/\//.test(output) ? [output] : [];
  if (Array.isArray(output)) return output.flatMap(extractUrls);
  if (output && typeof output === "object") return Object.values(output).flatMap(extractUrls);
  return [];
}
