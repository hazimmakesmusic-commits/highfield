import { NextResponse } from "next/server";
import type { EnvKey } from "@/lib/models";

/** Which provider keys are set (never their values), so the UI can say what's usable. */
export async function GET() {
  const keys: EnvKey[] = ["REPLICATE_API_TOKEN", "POLLINATIONS_API_KEY", "HF_TOKEN"];
  return NextResponse.json({
    keys: Object.fromEntries(keys.map((k) => [k, !!process.env[k]])),
    cloudStorage: !!(process.env.S3_ENDPOINT && process.env.S3_BUCKET),
  });
}
