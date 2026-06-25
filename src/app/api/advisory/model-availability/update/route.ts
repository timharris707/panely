import { NextResponse } from "next/server";
import { updateLocalCliTool, type LocalCliName } from "@/lib/ai/model-health";

const UPDATEABLE_TOOLS = new Set<LocalCliName>(["claude", "codex", "gemini", "agy"]);

function isUpdateableTool(value: unknown): value is LocalCliName {
  return typeof value === "string" && UPDATEABLE_TOOLS.has(value as LocalCliName);
}

function sameOrigin(request: Request) {
  const host = request.headers.get("host");
  if (!host) return false;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  return true;
}

function allowsLocalUpdate(request: Request) {
  const explicitHeader = request.headers.get("x-panely-local-update") === "1";
  const fetchSite = request.headers.get("sec-fetch-site");
  const browserSameSite = !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
  return explicitHeader && browserSameSite && sameOrigin(request);
}

export async function POST(request: Request) {
  try {
    if (!allowsLocalUpdate(request)) {
      return NextResponse.json({ error: "Local CLI updates require a same-origin Panely request." }, { status: 403 });
    }

    const body = await request.json();
    if (!isUpdateableTool(body?.tool)) {
      return NextResponse.json({ error: "Unsupported local CLI tool." }, { status: 400 });
    }

    const result = updateLocalCliTool(body.tool);
    return NextResponse.json({ result }, { status: result.ok ? 200 : 500 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
