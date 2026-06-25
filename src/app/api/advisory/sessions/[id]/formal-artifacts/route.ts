import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { buildFormalArtifactManifest, resolveFormalArtifactPath } from "@/lib/advisory/formal-artifact-manifest";
import { getAdvisorySession, type AdvisorySessionRecord } from "@/lib/advisory-session-store";
import { getCurrentUser } from "@/lib/local-user";
import type { AdvisorySession } from "@/types/advisory";

function canAccess(session: AdvisorySessionRecord, userId: string) {
  return typeof session.userId !== "string" || session.userId === userId;
}

function downloadName(relativePath: string) {
  return path.basename(relativePath).replace(/[^a-zA-Z0-9._-]+/g, "-") || "formal-artifact";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;
    const session = getAdvisorySession(id);

    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (!canAccess(session, user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const typedSession = session as AdvisorySession;
    if (typedSession.mode !== "formal-board" || !typedSession.formalBoard) {
      return NextResponse.json({ error: "Formal Board artifacts are only available for Formal Board sessions." }, { status: 400 });
    }

    let manifest: ReturnType<typeof buildFormalArtifactManifest>;
    try {
      manifest = buildFormalArtifactManifest({ session: typedSession });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 400 });
    }
    const artifactId = new URL(req.url).searchParams.get("artifact");
    if (!artifactId) {
      return NextResponse.json({ manifest });
    }

    const item = manifest.items.find((candidate) => candidate.id === artifactId || candidate.relativePath === artifactId);
    if (!item) {
      return NextResponse.json({ error: "Unknown formal artifact.", manifest }, { status: 404 });
    }
    if (!item.exists) {
      return NextResponse.json({ error: "Formal artifact has not been generated yet.", item, manifest }, { status: 404 });
    }

    let artifactPath: string;
    try {
      artifactPath = resolveFormalArtifactPath({
        state: typedSession.formalBoard,
        requestedPath: item.relativePath,
      });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 400 });
    }

    const bytes = fs.readFileSync(artifactPath);
    const headers = new Headers({
      "Content-Type": item.contentType,
      "Content-Length": String(bytes.byteLength),
      "X-Panely-Artifact-Status": manifest.status,
      "X-Panely-Artifact-Canonical": item.canonical ? "true" : "false",
    });
    if (new URL(req.url).searchParams.get("download") === "1") {
      headers.set("Content-Disposition", `attachment; filename="${downloadName(item.relativePath)}"`);
    }

    return new NextResponse(new Uint8Array(bytes), { headers });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
