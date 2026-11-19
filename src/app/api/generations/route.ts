import { NextResponse } from "next/server";
import { listGenerations, startGeneration } from "@/lib/generations";
import { TOOLS, type ToolId } from "@/lib/models";

export async function GET(req: Request) {
  const tool = new URL(req.url).searchParams.get("tool") as ToolId | null;
  if (tool && !TOOLS.some((t) => t.id === tool)) return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
  return NextResponse.json(await listGenerations(tool ?? undefined));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.modelId !== "string" || typeof body.values !== "object") {
    return NextResponse.json({ error: "modelId and values are required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await startGeneration(body.modelId, body.values, body.presets ?? {}), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
