import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function isLoopbackHost(host: string) {
  let hostname = host.toLowerCase();
  try {
    hostname = new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    hostname = host.split(":")[0]?.replace(/^\[|\]$/g, "").toLowerCase();
  }
  const normalized = hostname.replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
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
  return false;
}

function allowsWorkspacePicker(request: Request) {
  const explicitHeader = request.headers.get("x-panely-local-workspace-picker") === "1";
  const fetchSite = request.headers.get("sec-fetch-site");
  const browserSameSite = !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
  return explicitHeader && browserSameSite && sameOrigin(request);
}

function labelForFolder(folderPath: string) {
  return path.basename(folderPath.replace(/\/+$/, "")) || "local-workspace";
}

export async function POST(request: Request) {
  try {
    if (!allowsWorkspacePicker(request)) {
      return Response.json({ error: "Workspace folder picking requires a same-origin Panely request." }, { status: 403 });
    }

    if (process.platform !== "darwin") {
      return Response.json({ error: "Workspace folder picking is currently supported on macOS local runs." }, { status: 501 });
    }

    const script = [
      'set selectedFolder to choose folder with prompt "Choose a local workspace for Panely source snapshots:"',
      "POSIX path of selectedFolder",
    ].join("\n");

    const { stdout } = await execFileAsync("osascript", ["-e", script], { timeout: 120_000 });
    const workspacePath = stdout.trim().replace(/\/+$/, "");
    if (!workspacePath || !path.isAbsolute(workspacePath)) {
      return Response.json({ error: "No workspace folder was selected." }, { status: 400 });
    }

    const artifactPath = path.join(workspacePath, "Panely");
    await mkdir(artifactPath, { recursive: true });

    return Response.json({
      workspace: {
        label: labelForFolder(workspacePath),
        path: workspacePath,
        artifactTarget: artifactPath,
      },
    });
  } catch (err) {
    const error = err as { code?: number | string; message?: string; stderr?: string };
    const message = `${error.message || ""}\n${error.stderr || ""}`;
    if (error.code === 1 && message.includes("-128")) {
      return Response.json({ cancelled: true });
    }
    return Response.json({ error: error.message || "Unable to choose workspace folder." }, { status: 500 });
  }
}
