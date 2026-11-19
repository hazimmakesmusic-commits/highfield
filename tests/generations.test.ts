import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "ai-gen-"));
const { buildInput, saveGeneration, loadGeneration, listGenerations, deleteGeneration } = await import("@/lib/generations");
const { getStorage } = await import("@/lib/storage");
const { getModel } = await import("@/lib/models");

beforeAll(async () => {
  await getStorage().put("uploads/frame.png", new Uint8Array([137, 80, 78, 71]), "image/png");
});

describe("buildInput", () => {
  it("resolves uploaded media and applies only the model's preset kinds", async () => {
    const input = await buildInput(getModel("kling-2.1")!, { prompt: "a dancer", start_image: "uploads/frame.png", mode: "pro", duration: "10" },
      { camera: "orbit", style: "vhs" });
    expect(input.start_image).toBeInstanceOf(Blob);
    expect((input.start_image as Blob).type).toBe("image/png");
    expect(input.prompt).toContain("orbits 360");
    expect(input.prompt).not.toContain("VHS");
    expect(input.duration).toBe(10);
  });

  it("refuses missing fields and media outside the library", async () => {
    await expect(buildInput(getModel("kling-2.1")!, { prompt: "x" }, {})).rejects.toThrow("Start frame is required");
    await expect(buildInput(getModel("kling-2.1")!, { prompt: "x", start_image: "meta/secret.json" }, {})).rejects.toThrow();
  });
});

describe("generation records", () => {
  it("saves, lists newest first, filters by tool and deletes outputs", async () => {
    const base = { modelId: "m", modelName: "M", presets: {}, values: {}, status: "succeeded" as const, outputs: [] };
    await saveGeneration({ ...base, id: "a1", tool: "image", createdAt: "2026-01-01T00:00:00Z" });
    await getStorage().put("outputs/b2/0.mp4", new Uint8Array([1]), "video/mp4");
    await saveGeneration({ ...base, id: "b2", tool: "video", createdAt: "2026-02-01T00:00:00Z", outputs: [{ key: "outputs/b2/0.mp4", kind: "video" }] });
    expect((await listGenerations()).map((g) => g.id)).toEqual(["b2", "a1"]);
    expect((await listGenerations("image")).map((g) => g.id)).toEqual(["a1"]);
    await deleteGeneration((await loadGeneration("b2"))!);
    expect(await loadGeneration("b2")).toBeNull();
    expect(await getStorage().readBytes("outputs/b2/0.mp4")).toBeNull();
    expect(await loadGeneration("../x")).toBeNull();
  });
});
