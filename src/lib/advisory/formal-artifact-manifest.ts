import fs from "node:fs";
import path from "node:path";
import type { AdvisorySession, FormalBoardState } from "../../types/advisory.ts";
import { formalVerdictArtifactName } from "./formal-artifacts.ts";

export type FormalArtifactKind =
  | "source"
  | "state"
  | "round"
  | "board-packet"
  | "verdict"
  | "metadata"
  | "handoff"
  | "final";

export type FormalManifestStatus = "completed-valid" | "completed-invalid" | "incomplete" | "unavailable";

export interface FormalArtifactManifestItem {
  id: string;
  label: string;
  kind: FormalArtifactKind;
  relativePath: string;
  exists: boolean;
  required: boolean;
  canonical: boolean;
  sizeBytes?: number;
  modifiedAt?: string;
  contentType: string;
}

export interface FormalArtifactManifest {
  sessionId: string;
  title: string;
  status: FormalManifestStatus;
  sourcePacketHash?: string;
  isolation: unknown;
  items: FormalArtifactManifestItem[];
}

function safeArtifactName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "seat";
}

function contentTypeFor(relativePath: string) {
  if (relativePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (relativePath.endsWith(".html")) return "text/html; charset=utf-8";
  return "text/markdown; charset=utf-8";
}

export function getFormalArtifactRoot(state: FormalBoardState, cwd = process.cwd()) {
  if (!state.artifactDir) return null;
  const root = path.resolve(cwd, state.artifactDir);
  const expectedBase = path.resolve(cwd, "data", "advisory", "formal-runs");
  if (!isInside(expectedBase, root)) {
    throw new Error("Formal artifact directory is outside Panely formal-runs storage.");
  }
  return root;
}

function decodeRequestedPath(requestedPath: string) {
  try {
    return decodeURIComponent(requestedPath);
  } catch {
    return requestedPath;
  }
}

function isInside(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative === "" || (Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative));
}

export function resolveFormalArtifactPath(input: {
  state: FormalBoardState;
  requestedPath: string;
  cwd?: string;
  fsImpl?: Pick<typeof fs, "existsSync" | "realpathSync">;
}) {
  const root = getFormalArtifactRoot(input.state, input.cwd);
  if (!root) throw new Error("Formal artifact directory is not available.");

  const fsImpl = input.fsImpl || fs;
  const decoded = decodeRequestedPath(input.requestedPath).replace(/\\/g, "/");
  if (!decoded || decoded.includes("\0") || path.isAbsolute(decoded)) {
    throw new Error("Invalid formal artifact path.");
  }

  const target = path.resolve(root, decoded);
  if (!isInside(root, target)) {
    throw new Error("Formal artifact path escapes the artifact directory.");
  }

  if (fsImpl.existsSync(root) && fsImpl.existsSync(target)) {
    const realRoot = fsImpl.realpathSync(root);
    const realTarget = fsImpl.realpathSync(target);
    if (!isInside(realRoot, realTarget)) {
      throw new Error("Formal artifact realpath escapes the artifact directory.");
    }
    return realTarget;
  }

  return target;
}

function manifestStatus(session: AdvisorySession): FormalManifestStatus {
  const formalBoard = session.formalBoard;
  if (!formalBoard?.artifactDir) return "unavailable";
  if (!formalBoard.verdict || formalBoard.phase !== "complete") return "incomplete";
  return formalBoard.verdict.valid ? "completed-valid" : "completed-invalid";
}

function uniqueItems<T extends { relativePath: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.relativePath)) return false;
    seen.add(item.relativePath);
    return true;
  });
}

export function missingRequiredFormalArtifacts(input: {
  session: AdvisorySession;
  cwd?: string;
  fsImpl?: Pick<typeof fs, "existsSync" | "statSync">;
}) {
  const manifest = buildFormalArtifactManifest(input);
  return manifest.items.filter((item) => item.required && !item.exists);
}

export function allRequiredFormalArtifactsExist(input: {
  session: AdvisorySession;
  cwd?: string;
  fsImpl?: Pick<typeof fs, "existsSync" | "statSync">;
}) {
  return missingRequiredFormalArtifacts(input).length === 0;
}

export function buildFormalArtifactManifest(input: {
  session: AdvisorySession;
  cwd?: string;
  fsImpl?: Pick<typeof fs, "existsSync" | "statSync">;
}): FormalArtifactManifest {
  const state = input.session.formalBoard;
  const fsImpl = input.fsImpl || fs;
  const title = input.session.title || input.session.topic.slice(0, 90);
  const root = state ? getFormalArtifactRoot(state, input.cwd) : null;
  const status = manifestStatus(input.session);

  const base: Array<Omit<FormalArtifactManifestItem, "exists" | "sizeBytes" | "modifiedAt" | "contentType">> = [
    { id: "source-packet", label: "Source Packet", kind: "source", relativePath: "source-packet.md", required: true, canonical: true },
    { id: "formal-board-state", label: "Formal Board State", kind: "state", relativePath: "formal-board-state.json", required: true, canonical: false },
  ];

  if (state) {
    for (const artifact of state.rounds) {
      base.push({
        id: `round-${artifact.round}-${safeArtifactName(artifact.agentId)}`,
        label: `Round ${artifact.round} - ${artifact.agentId}`,
        kind: "round",
        relativePath: `round-${artifact.round}/${safeArtifactName(artifact.agentId)}.md`,
        required: artifact.status === "ran",
        canonical: false,
      });
    }
  }

  base.push(
    { id: "board-packet-round-2", label: "Round 2 Board Packet", kind: "board-packet", relativePath: "board-packet-round-2.md", required: status !== "unavailable", canonical: false },
    {
      id: "verdict",
      label: status === "completed-invalid" ? "Invalid Verdict" : "Verdict",
      kind: "verdict",
      relativePath: state?.verdict ? formalVerdictArtifactName(state.verdict) : "verdict.json",
      required: status !== "unavailable",
      canonical: status === "completed-valid",
    },
    { id: "run-metadata", label: "Run Metadata", kind: "metadata", relativePath: "run-metadata.md", required: status !== "unavailable", canonical: true },
    { id: "handoff-data", label: "Handoff Data", kind: "handoff", relativePath: "handoff-data.json", required: status !== "unavailable", canonical: false },
    { id: "clerk-synthesis", label: "Clerk Synthesis", kind: "final", relativePath: "clerk-synthesis.md", required: false, canonical: false },
    { id: "final-consensus-md", label: "Final Consensus Markdown", kind: "final", relativePath: "final-consensus.md", required: status !== "unavailable", canonical: true },
    { id: "final-consensus-html", label: "Final Consensus HTML", kind: "final", relativePath: "final-consensus.html", required: status !== "unavailable", canonical: true }
  );

  const items = uniqueItems(base).map((item) => {
    const exists = Boolean(root && fsImpl.existsSync(path.join(root, item.relativePath)));
    const stat = exists && root ? fsImpl.statSync(path.join(root, item.relativePath)) : null;
    return {
      ...item,
      exists,
      sizeBytes: stat ? stat.size : undefined,
      modifiedAt: stat ? stat.mtime.toISOString() : undefined,
      contentType: contentTypeFor(item.relativePath),
    };
  });

  return {
    sessionId: input.session.id,
    title,
    status,
    sourcePacketHash: state?.sourcePacketHash,
    isolation: state && "isolation" in state ? (state as FormalBoardState & { isolation?: unknown }).isolation : null,
    items,
  };
}
