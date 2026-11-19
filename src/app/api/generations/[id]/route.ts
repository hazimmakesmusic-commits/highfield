import { NextResponse } from "next/server";
import { deleteGeneration, loadGeneration, refreshGeneration } from "@/lib/generations";

export const maxDuration = 300; // copying a finished video into storage can take a while

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const g = await loadGeneration((await params).id);
  if (!g) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return NextResponse.json(await refreshGeneration(g));
  } catch (e) {
    return NextResponse.json({ ...g, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await loadGeneration((await params).id);
  if (!g) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteGeneration(g);
  return NextResponse.json({ ok: true });
}
