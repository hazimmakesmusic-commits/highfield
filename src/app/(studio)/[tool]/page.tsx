import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TOOLS, type ToolId } from "@/lib/models";
import { Studio } from "@/components/studio";

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  if (!TOOLS.some((t) => t.id === tool)) notFound();
  return <Suspense><Studio key={tool} tool={tool as ToolId} /></Suspense>;
}
