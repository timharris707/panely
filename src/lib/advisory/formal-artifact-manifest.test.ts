import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { AdvisorySession, FormalBoardState, FormalBoardVerdict } from "../../types/advisory.ts";
import { buildFormalArtifactManifest, resolveFormalArtifactPath } from "./formal-artifact-manifest.ts";

function tempRoot() {
  return mkdtempSync(path.join(tmpdir(), "panely-formal-artifacts-"));
}

function baseState(artifactDir: string): FormalBoardState {
  return {
    protocol: "advisory-board/formal@1",
    phase: "complete",
    sourcePacketHash: "abc123",
    sourcePacketPreview: "Review this.",
    artifactDir,
    seats: [
      { agentId: "A", status: "ran", roundsCompleted: 2, model: "codex:gpt-5.5" },
      { agentId: "B", status: "ran", roundsCompleted: 2, model: "claude:opus-4.8" },
    ],
    rounds: [
      { round: 1, agentId: "A", status: "ran", text: "A1", generatedAt: "2026-06-25T00:00:00.000Z" },
      { round: 1, agentId: "B", status: "ran", text: "B1", generatedAt: "2026-06-25T00:00:00.000Z" },
      { round: 2, agentId: "A", status: "ran", text: "A2", generatedAt: "2026-06-25T00:00:00.000Z" },
      { round: 2, agentId: "B", status: "ran", text: "B2", generatedAt: "2026-06-25T00:00:00.000Z" },
    ],
  };
}

function verdict(valid: boolean): FormalBoardVerdict {
  return {
    schema: "advisory-board/verdict@1",
    title: "Review",
    date: "2026-06-25",
    verdict: "caution",
    confidence: "medium",
    unanimous: true,
    rounds: 2,
    board: [
      { seat: "A", model: "codex:gpt-5.5", round_verdicts: ["caution", "caution"], dropped: false },
      { seat: "B", model: "claude:opus-4.8", round_verdicts: ["caution", "caution"], dropped: false },
    ],
    blockers: [],
    dissent: [],
    open_questions: [],
    next_actions: [],
    summary: "Proceed carefully.",
    evidenceBacked: [],
    judgmentCalls: [],
    couldntVerify: [],
    minorityReport: [],
    droppedSeats: [],
    degradedSeats: [],
    valid,
    sameSeatContinuity: ["A", "B"],
  };
}

function session(state: FormalBoardState): AdvisorySession {
  return {
    id: "session-test",
    topic: "Review this plan",
    mode: "formal-board",
    agents: ["A", "B"],
    status: "completed",
    createdAt: "2026-06-25T00:00:00.000Z",
    formalBoard: state,
  };
}

test("formal artifact manifest exposes valid artifacts as canonical", () => {
  const cwd = tempRoot();
  const artifactDir = "data/advisory/formal-runs/session-test";
  const root = path.join(cwd, artifactDir);
  mkdirSync(path.join(root, "round-1"), { recursive: true });
  writeFileSync(path.join(root, "source-packet.md"), "source");
  writeFileSync(path.join(root, "verdict.json"), "{}");
  writeFileSync(path.join(root, "round-1/a.md"), "A1");

  const state = { ...baseState(artifactDir), verdict: verdict(true) };
  const manifest = buildFormalArtifactManifest({ session: session(state), cwd });

  assert.equal(manifest.status, "completed-valid");
  assert.equal(manifest.sourcePacketHash, "abc123");
  assert.equal(manifest.items.find((item) => item.id === "verdict")?.relativePath, "verdict.json");
  assert.equal(manifest.items.find((item) => item.id === "verdict")?.canonical, true);
  assert.equal(manifest.items.find((item) => item.id === "source-packet")?.exists, true);
});

test("formal artifact manifest exposes invalid verdicts without canonical labeling", () => {
  const cwd = tempRoot();
  const artifactDir = "data/advisory/formal-runs/session-invalid";
  const root = path.join(cwd, artifactDir);
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, "panely-invalid-verdict.json"), "{}");

  const state = { ...baseState(artifactDir), verdict: verdict(false) };
  const manifest = buildFormalArtifactManifest({ session: session(state), cwd });
  const item = manifest.items.find((candidate) => candidate.id === "verdict");

  assert.equal(manifest.status, "completed-invalid");
  assert.equal(item?.relativePath, "panely-invalid-verdict.json");
  assert.equal(item?.canonical, false);
  assert.equal(item?.exists, true);
});

test("formal artifact manifest exposes incomplete runs", () => {
  const cwd = tempRoot();
  const artifactDir = "data/advisory/formal-runs/session-incomplete";
  const state = { ...baseState(artifactDir), phase: "round-2" as const };
  const manifest = buildFormalArtifactManifest({ session: { ...session(state), status: "active" }, cwd });

  assert.equal(manifest.status, "incomplete");
  assert.equal(manifest.items.find((item) => item.id === "verdict")?.exists, false);
});

test("formal artifact resolver rejects traversal and absolute paths", () => {
  const cwd = tempRoot();
  const artifactDir = "data/advisory/formal-runs/session-test";
  const root = path.join(cwd, artifactDir);
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, "source-packet.md"), "source");
  const state = baseState(artifactDir);

  assert.equal(
    resolveFormalArtifactPath({ state, requestedPath: "source-packet.md", cwd }),
    fs.realpathSync(path.join(root, "source-packet.md"))
  );
  assert.throws(() => resolveFormalArtifactPath({ state, requestedPath: "../secret.txt", cwd }), /escapes/);
  assert.throws(() => resolveFormalArtifactPath({ state, requestedPath: "%2e%2e/secret.txt", cwd }), /escapes/);
  assert.throws(() => resolveFormalArtifactPath({ state, requestedPath: path.join(cwd, "secret.txt"), cwd }), /Invalid/);
});

test("formal artifact manifest rejects artifact roots outside formal-runs", () => {
  const cwd = tempRoot();
  const outside = path.join(cwd, "outside-formal-run");
  mkdirSync(outside, { recursive: true });

  assert.throws(
    () => buildFormalArtifactManifest({ session: session(baseState(outside)), cwd }),
    /outside Panely formal-runs/
  );
  assert.throws(
    () => resolveFormalArtifactPath({ state: baseState(outside), requestedPath: "source-packet.md", cwd }),
    /outside Panely formal-runs/
  );
});

test("formal artifact resolver rejects symlink realpath escape", { skip: process.platform === "win32" }, () => {
  const cwd = tempRoot();
  const artifactDir = "data/advisory/formal-runs/session-test";
  const root = path.join(cwd, artifactDir);
  const outside = path.join(cwd, "outside");
  mkdirSync(root, { recursive: true });
  mkdirSync(outside, { recursive: true });
  writeFileSync(path.join(outside, "secret.md"), "secret");
  symlinkSync(path.join(outside, "secret.md"), path.join(root, "linked-secret.md"));

  assert.throws(
    () => resolveFormalArtifactPath({ state: baseState(artifactDir), requestedPath: "linked-secret.md", cwd }),
    /realpath escapes/
  );

  assert.equal(fs.existsSync(path.join(root, "linked-secret.md")), true);
});
