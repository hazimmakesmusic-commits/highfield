import { describe, expect, it } from "vitest";
import { MODELS, TOOLS, defaultValues, extractUrls, getModel, isFree, missingField, modelsFor, needsFor } from "@/lib/models";
import { CAMERA_PRESETS, EFFECT_PRESETS, STYLE_PRESETS, composePrompt } from "@/lib/presets";

describe("model catalogue", () => {
  it("has unique ids and models for every tool", () => {
    expect(new Set(MODELS.map((m) => m.id)).size).toBe(MODELS.length);
    for (const t of TOOLS) expect(modelsFor(t.id).length).toBeGreaterThan(0);
  });

  it("every model builds a Replicate input that carries its required fields", () => {
    for (const m of MODELS) {
      const v = defaultValues(m);
      for (const f of m.fields) if (f.required) v[f.name] = f.type === "prompt" || f.type === "text" ? "a test prompt" : `https://x.test/${f.name}`;
      expect(missingField(m, v), m.id).toBeNull();
      const input = m.build(v);
      if (m.provider === "hf") {
        expect(input.api, m.id).toMatch(/^\//);
        const flat = JSON.stringify(input.data);
        for (const f of m.fields) if (f.required) expect(flat, `${m.id}.${f.name}`).toContain(String(v[f.name]));
        continue;
      }
      for (const f of m.fields) if (f.required) expect(input[f.name], `${m.id}.${f.name}`).toBe(v[f.name]);
      for (const val of Object.values(input)) expect(val, m.id).not.toBeUndefined();
      // select defaults must be one of their options
      for (const f of m.fields) if (f.type === "select") expect(f.options, `${m.id}.${f.name}`).toContain(f.default ?? f.options![0]);
    }
  });

  it("casts numeric selects and drops empty optionals", () => {
    const kling = getModel("kling-2.1")!;
    const input = kling.build({ ...defaultValues(kling), prompt: "p", start_image: "u", negative_prompt: "" });
    expect(input.duration).toBe(5);
    expect("negative_prompt" in input).toBe(false);
  });

  it("reports the missing required field", () => {
    expect(missingField(getModel("omni-human")!, { image: "x" })).toBe("Vocals or speech");
    expect(missingField(getModel("flux-ultra")!, { prompt: "   " })).toBe("Prompt");
  });
});

describe("free providers", () => {
  it("puts a free, usable model first for every tool", () => {
    for (const t of TOOLS) expect(isFree(modelsFor(t.id)[0]), t.id).toBe(true);
    expect(needsFor(getModel("free-sana")!)).toBeNull();
    expect(needsFor(getModel("free-ltx")!)).toBe("HF_TOKEN");
    expect(needsFor(getModel("kling-2.1")!)).toBe("REPLICATE_API_TOKEN");
    expect(needsFor(getModel("free-z-image")!)).toBe("POLLINATIONS_API_KEY");
  });
  it("maps aspect ratios to Pollinations pixel sizes", () => {
    expect(getModel("free-flux-schnell")!.build({ prompt: "p", aspect_ratio: "9:16" })).toEqual({ model: "black-forest-labs/flux.1-schnell", prompt: "p", width: 768, height: 1344 });
    expect(getModel("free-sana")!.build({ prompt: "p" })).toEqual({ model: "sana", prompt: "p", width: 1024, height: 1024 });
  });
  it("switches LTX between text and image mode", () => {
    const ltx = getModel("free-ltx")!;
    const t2v = ltx.build({ prompt: "p", duration: "3", aspect_ratio: "9:16" }) as { api: string; data: unknown[] };
    expect(t2v.api).toBe("/text_to_video");
    expect(t2v.data.slice(2, 8)).toEqual([null, null, 832, 480, "text-to-video", 3]);
    const img = { path: "/tmp/x.png", meta: { _type: "gradio.FileData" } };
    const i2v = ltx.build({ prompt: "p", image: img, duration: "2", aspect_ratio: "16:9" }) as { api: string; data: unknown[] };
    expect(i2v.api).toBe("/image_to_video");
    expect(i2v.data[2]).toBe(img);
    expect(i2v.data[6]).toBe("image-to-video");
  });
});

describe("presets", () => {
  it("composes prompts", () => {
    expect(composePrompt("a singer on a rooftop", { camera: "orbit", effect: "rain" }))
      .toBe(`a singer on a rooftop. ${CAMERA_PRESETS.find((p) => p.id === "orbit")!.prompt}. ${EFFECT_PRESETS.find((p) => p.id === "rain")!.prompt}`);
    expect(composePrompt("  x  ")).toBe("x");
    expect(() => composePrompt("x", { style: "nope" })).toThrow();
  });
  it("has unique ids per kind", () => {
    for (const list of [STYLE_PRESETS, CAMERA_PRESETS, EFFECT_PRESETS]) expect(new Set(list.map((p) => p.id)).size).toBe(list.length);
  });
});

describe("extractUrls", () => {
  it("handles every Replicate output shape", () => {
    expect(extractUrls("https://a/x.png")).toEqual(["https://a/x.png"]);
    expect(extractUrls(["https://a/1.png", "https://a/2.png"])).toHaveLength(2);
    expect(extractUrls({ video: "https://a/v.mp4", meta: 3 })).toEqual(["https://a/v.mp4"]);
    expect(extractUrls(null)).toEqual([]);
    expect(extractUrls("not a url")).toEqual([]);
  });
});
