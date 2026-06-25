import { buildProjectContext } from "../../../../lib/advisory/project-context.ts";

export const runtime = "nodejs";

function isLoopbackHost(host: string) {
  const hostname = host.split(":")[0]?.replace(/^\[|\]$/g, "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function sameOrigin(request: Request) {
  const host = request.headers.get("host");
  if (!host || !isLoopbackHost(host)) return false;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      return parsed.host === host && isLoopbackHost(parsed.host);
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const parsed = new URL(referer);
      return parsed.host === host && isLoopbackHost(parsed.host);
    } catch {
      return false;
    }
  }
  return true;
}

function allowsProjectScan(request: Request) {
  const explicitHeader = request.headers.get("x-panely-local-project-scan") === "1";
  const fetchSite = request.headers.get("sec-fetch-site");
  const browserSameSite = !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
  return explicitHeader && browserSameSite && sameOrigin(request);
}

export async function POST(request: Request) {
  try {
    if (!allowsProjectScan(request)) {
      return Response.json({ error: "Local project scans require a same-origin Panely request." }, { status: 403 });
    }

    const body = await request.json();
    const projectPath = String(body?.projectPath || "").trim();
    const topic = String(body?.topic || "");
    const contextBudgetChars = Number(body?.contextBudgetChars || 50_000);
    if (!projectPath) {
      return Response.json({ error: "projectPath is required" }, { status: 400 });
    }

    const result = buildProjectContext({ projectPath, topic, contextBudgetChars });
    return Response.json({ projectContext: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /absolute local path|does not exist|must be a directory|Refusing to scan|symlink/.test(message) ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
