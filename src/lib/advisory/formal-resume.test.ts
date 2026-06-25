import assert from "node:assert/strict";
import test from "node:test";
import type { AdvisoryRunStep, AdvisorySession, FormalBoardState } from "../../types/advisory.ts";
import {
  createFormalResumeLease,
  formalStepKey,
  getFormalResumeStatus,
  isFreshFormalResumeLease,
} from "./formal-resume.ts";

function state(rounds: FormalBoardState["rounds"] = []): FormalBoardState {
  return {
    protocol: "advisory-board/formal@1",
    phase: rounds.some((artifact) => artifact.round === 2) ? "synthesis" : "round-1",
    sourcePacketHash: "hash123",
    sourcePacketPreview: "preview",
    artifactDir: "data/advisory/formal-runs/session-test",
    seats: [
      { agentId: "A", status: "ran", roundsCompleted: 0 },
      { agentId: "B", status: "ran", roundsCompleted: 0 },
      { agentId: "C", status: "ran", roundsCompleted: 0 },
    ],
    rounds,
  };
}

function session(formalBoard: FormalBoardState, runSteps: AdvisoryRunStep[] = []): AdvisorySession {
  return {
    id: "session-test",
    topic: "Review this",
    mode: "formal-board",
    agents: ["A", "B", "C"],
    status: "active",
    createdAt: "2026-06-25T00:00:00.000Z",
    formalBoard,
    runSteps,
  };
}

test("formalStepKey is deterministic and source-hash scoped", () => {
  assert.equal(
    formalStepKey({ sessionId: "s1", sourceHash: "hash", phase: "formal-round-1", agentId: "A" }),
    "formal:s1:hash:formal-round-1:A"
  );
});

test("formal resume picks first missing round one step", () => {
  const status = getFormalResumeStatus(session(state()), Date.parse("2026-06-25T09:00:00.000Z"));

  assert.equal(status.canResume, true);
  assert.equal(status.nextStep?.phase, "formal-round-1");
  assert.equal(status.nextStep?.agentId, "A");
});

test("formal resume picks round two only for successful round one seats", () => {
  const status = getFormalResumeStatus(session(state([
    { round: 1, agentId: "A", status: "ran", text: "A1", generatedAt: "2026-06-25T00:00:00.000Z" },
    { round: 1, agentId: "B", status: "ran", text: "B1", generatedAt: "2026-06-25T00:00:00.000Z" },
    { round: 1, agentId: "C", status: "degraded", text: "C failed", generatedAt: "2026-06-25T00:00:00.000Z" },
  ])));

  assert.equal(status.canResume, true);
  assert.equal(status.nextStep?.phase, "formal-round-2");
  assert.equal(status.nextStep?.agentId, "A");
});

test("formal resume picks synthesis after same-seat round two continuity", () => {
  const formalBoard = state([
    { round: 1, agentId: "A", status: "ran", text: "A1", generatedAt: "2026-06-25T00:00:00.000Z" },
    { round: 1, agentId: "B", status: "ran", text: "B1", generatedAt: "2026-06-25T00:00:00.000Z" },
    { round: 2, agentId: "A", status: "ran", text: "A2", generatedAt: "2026-06-25T00:00:00.000Z" },
    { round: 2, agentId: "B", status: "ran", text: "B2", generatedAt: "2026-06-25T00:00:00.000Z" },
  ]);
  formalBoard.seats = formalBoard.seats.slice(0, 2);
  const status = getFormalResumeStatus(session(formalBoard));

  assert.equal(status.canResume, true);
  assert.equal(status.nextStep?.phase, "formal-synthesis");
});

test("formal resume picks missing round three seat when convergence started", () => {
  const formalBoard = state([
    { round: 1, agentId: "A", status: "ran", text: "A1", generatedAt: "2026-06-25T00:00:00.000Z" },
    { round: 1, agentId: "B", status: "ran", text: "B1", generatedAt: "2026-06-25T00:00:00.000Z" },
    { round: 2, agentId: "A", status: "ran", text: "A2", generatedAt: "2026-06-25T00:00:00.000Z" },
    { round: 2, agentId: "B", status: "ran", text: "B2", generatedAt: "2026-06-25T00:00:00.000Z" },
    { round: 3, agentId: "A", status: "ran", text: "A3", generatedAt: "2026-06-25T00:00:00.000Z" },
  ]);
  formalBoard.seats = formalBoard.seats.slice(0, 2);
  formalBoard.phase = "round-3";
  const status = getFormalResumeStatus(session(formalBoard));

  assert.equal(status.canResume, true);
  assert.equal(status.nextStep?.phase, "formal-round-3");
  assert.equal(status.nextStep?.agentId, "B");
});

test("formal resume reports round three before it starts when convergence is always", () => {
  const formalBoard = state([
    { round: 1, agentId: "A", status: "ran", text: "A1", generatedAt: "2026-06-25T00:00:00.000Z" },
    { round: 1, agentId: "B", status: "ran", text: "B1", generatedAt: "2026-06-25T00:00:00.000Z" },
    { round: 2, agentId: "A", status: "ran", text: "## Verdict\nCAUTION", generatedAt: "2026-06-25T00:00:00.000Z" },
    { round: 2, agentId: "B", status: "ran", text: "## Verdict\nCAUTION", generatedAt: "2026-06-25T00:00:00.000Z" },
  ]);
  formalBoard.seats = formalBoard.seats.slice(0, 2);
  const status = getFormalResumeStatus({ ...session(formalBoard), formalConvergence: "always" });

  assert.equal(status.canResume, true);
  assert.equal(status.nextStep?.phase, "formal-round-3");
  assert.equal(status.nextStep?.agentId, "A");
});

test("formal resume reruns synthesis when complete state is missing required artifacts", () => {
  const formalBoard = state([
    { round: 1, agentId: "A", status: "ran", text: "A1", generatedAt: "2026-06-25T00:00:00.000Z" },
    { round: 1, agentId: "B", status: "ran", text: "B1", generatedAt: "2026-06-25T00:00:00.000Z" },
    { round: 2, agentId: "A", status: "ran", text: "## Verdict\nCAUTION", generatedAt: "2026-06-25T00:00:00.000Z" },
    { round: 2, agentId: "B", status: "ran", text: "## Verdict\nCAUTION", generatedAt: "2026-06-25T00:00:00.000Z" },
  ]);
  formalBoard.seats = formalBoard.seats.slice(0, 2);
  formalBoard.phase = "complete";
  formalBoard.verdict = {
    schema: "advisory-board/verdict@1",
    title: "Review this",
    date: "2026-06-25",
    verdict: "caution",
    confidence: "medium",
    unanimous: true,
    rounds: 2,
    board: [],
    blockers: [],
    dissent: [],
    open_questions: [],
    next_actions: [],
    summary: "Needs caution.",
    evidenceBacked: [],
    judgmentCalls: [],
    couldntVerify: [],
    minorityReport: [],
    droppedSeats: [],
    degradedSeats: [],
    valid: true,
    sameSeatContinuity: ["A", "B"],
  };
  const status = getFormalResumeStatus(session(formalBoard));

  assert.equal(status.canResume, true);
  assert.equal(status.nextStep?.phase, "formal-synthesis");
});

test("formal resume blocks fresh leases and fresh running steps", () => {
  const now = new Date("2026-06-25T09:00:00.000Z");
  const formalBoard = { ...state(), resumeLease: createFormalResumeLease("lease-1", now) };
  const leaseStatus = getFormalResumeStatus(session(formalBoard), now.getTime());
  assert.equal(leaseStatus.canResume, false);
  assert.equal(leaseStatus.hasFreshLease, true);

  const step: AdvisoryRunStep = {
    id: "step-1",
    key: "formal:session-test:hash123:formal-round-1:A",
    sessionId: "session-test",
    index: 0,
    phase: "formal-round-1",
    agentId: "A",
    model: "codex:gpt-5.5",
    status: "running",
    startedAt: "2026-06-25T08:59:00.000Z",
    heartbeatAt: "2026-06-25T08:59:30.000Z",
  };
  const runningStatus = getFormalResumeStatus(session(state(), [step]), now.getTime());
  assert.equal(runningStatus.canResume, false);
  assert.equal(runningStatus.hasFreshRunningStep, true);
});

test("formal resume allows expired leases and stale steps", () => {
  const lease = createFormalResumeLease("lease-1", new Date("2026-06-25T09:00:00.000Z"));
  assert.equal(isFreshFormalResumeLease(lease, Date.parse("2026-06-25T09:14:00.000Z")), true);
  assert.equal(isFreshFormalResumeLease(lease, Date.parse("2026-06-25T09:16:00.000Z")), false);

  const step: AdvisoryRunStep = {
    id: "step-1",
    sessionId: "session-test",
    index: 0,
    phase: "formal-round-1",
    agentId: "A",
    model: "codex:gpt-5.5",
    status: "running",
    startedAt: "2026-06-25T08:40:00.000Z",
    heartbeatAt: "2026-06-25T08:40:00.000Z",
  };
  const status = getFormalResumeStatus(session({ ...state(), resumeLease: lease }, [step]), Date.parse("2026-06-25T09:16:00.000Z"));
  assert.equal(status.canResume, true);
  assert.equal(status.staleSteps.length, 1);
});
