import type {
  AdvisoryRunStep,
  AdvisorySession,
  FormalBoardPhase,
  FormalBoardResumeLease,
  FormalBoardRoundArtifact,
  FormalBoardState,
} from "../../types/advisory.ts";
import { isRunStepStale } from "./run-ledger.ts";
import { allRequiredFormalArtifactsExist } from "./formal-artifact-manifest.ts";
import { shouldRunFormalRoundThree } from "./formal-board.ts";

export const FORMAL_RESUME_LEASE_TTL_MS = 15 * 60 * 1000;

export type FormalStepPhase = "formal-round-1" | "formal-round-2" | "formal-round-3" | "formal-synthesis";

export interface FormalResumeStep {
  key: string;
  phase: FormalStepPhase;
  formalPhase: FormalBoardPhase;
  agentId: string;
  round?: 1 | 2 | 3;
}

export interface FormalResumeStatus {
  canResume: boolean;
  reason: string;
  nextStep?: FormalResumeStep;
  staleSteps: AdvisoryRunStep[];
  failedSteps: AdvisoryRunStep[];
  hasFreshLease: boolean;
  hasFreshRunningStep: boolean;
}

export function formalStepKey(input: {
  sessionId: string;
  sourceHash: string;
  phase: FormalStepPhase;
  agentId: string;
}) {
  return `formal:${input.sessionId}:${input.sourceHash}:${input.phase}:${input.agentId}`;
}

export function isFreshFormalResumeLease(lease: FormalBoardResumeLease | undefined, nowMs = Date.now()) {
  if (!lease) return false;
  const expiresAt = Date.parse(lease.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > nowMs;
}

export function createFormalResumeLease(id: string, now = new Date()): FormalBoardResumeLease {
  const acquiredAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + FORMAL_RESUME_LEASE_TTL_MS).toISOString();
  return { id, acquiredAt, expiresAt };
}

function formalSteps(steps: AdvisoryRunStep[] = []) {
  return steps.filter((step) => step.phase.startsWith("formal-"));
}

function successfulRound(state: FormalBoardState, round: 1 | 2 | 3) {
  return state.rounds.filter((artifact) => artifact.round === round && artifact.status === "ran");
}

function sameSeatRoundTwoContinuity(state: FormalBoardState) {
  const roundOne = new Set(successfulRound(state, 1).map((artifact) => artifact.agentId));
  return successfulRound(state, 2).filter((artifact) => roundOne.has(artifact.agentId));
}

function firstMissingRoundOneSeat(state: FormalBoardState) {
  const completed = new Set(state.rounds.filter((artifact) => artifact.round === 1).map((artifact) => artifact.agentId));
  return state.seats.find((seat) => seat.status !== "dropped" && !completed.has(seat.agentId))?.agentId;
}

function firstMissingRoundTwoSeat(state: FormalBoardState) {
  const roundTwo = new Set(state.rounds.filter((artifact) => artifact.round === 2).map((artifact) => artifact.agentId));
  return successfulRound(state, 1).find((artifact) => !roundTwo.has(artifact.agentId))?.agentId;
}

function firstMissingRoundThreeSeat(state: FormalBoardState) {
  const roundThree = new Set(state.rounds.filter((artifact) => artifact.round === 3).map((artifact) => artifact.agentId));
  return sameSeatRoundTwoContinuity(state).find((artifact) => !roundThree.has(artifact.agentId))?.agentId;
}

function nextFormalStep(session: AdvisorySession, state: FormalBoardState): FormalResumeStep | undefined {
  const sessionId = session.id;
  const sourceHash = state.sourcePacketHash;
  const roundOneSeat = firstMissingRoundOneSeat(state);
  if (roundOneSeat) {
    return {
      key: formalStepKey({ sessionId, sourceHash, phase: "formal-round-1", agentId: roundOneSeat }),
      phase: "formal-round-1",
      formalPhase: "round-1",
      agentId: roundOneSeat,
      round: 1,
    };
  }

  if (successfulRound(state, 1).length < 2) {
    return undefined;
  }

  const roundTwoSeat = firstMissingRoundTwoSeat(state);
  if (roundTwoSeat) {
    return {
      key: formalStepKey({ sessionId, sourceHash, phase: "formal-round-2", agentId: roundTwoSeat }),
      phase: "formal-round-2",
      formalPhase: "round-2",
      agentId: roundTwoSeat,
      round: 2,
    };
  }

  if (sameSeatRoundTwoContinuity(state).length < 2) {
    return undefined;
  }

  const roundThreeStarted = state.phase === "round-3" || state.rounds.some((artifact) => artifact.round === 3);
  const roundThreeDecision = shouldRunFormalRoundThree(state, session.formalConvergence || "auto");
  if (roundThreeStarted || roundThreeDecision.run) {
    const roundThreeSeat = firstMissingRoundThreeSeat(state);
    if (roundThreeSeat) {
      return {
        key: formalStepKey({ sessionId, sourceHash, phase: "formal-round-3", agentId: roundThreeSeat }),
        phase: "formal-round-3",
        formalPhase: "round-3",
        agentId: roundThreeSeat,
        round: 3,
      };
    }
    if (successfulRound(state, 3).length < 2) {
      return undefined;
    }
  }

  if (state.phase === "complete" && state.verdict && !allRequiredFormalArtifactsExist({ session })) {
    return {
      key: formalStepKey({ sessionId, sourceHash, phase: "formal-synthesis", agentId: "formal-board-clerk" }),
      phase: "formal-synthesis",
      formalPhase: "synthesis",
      agentId: "formal-board-clerk",
    };
  }

  if (state.phase !== "complete" || !state.verdict) {
    return {
      key: formalStepKey({ sessionId, sourceHash, phase: "formal-synthesis", agentId: "formal-board-clerk" }),
      phase: "formal-synthesis",
      formalPhase: "synthesis",
      agentId: "formal-board-clerk",
    };
  }

  return undefined;
}

export function getFormalResumeStatus(session: AdvisorySession, nowMs = Date.now()): FormalResumeStatus {
  const state = session.formalBoard;
  if (session.mode !== "formal-board" || !state) {
    return {
      canResume: false,
      reason: "Session is not a Formal Board Review.",
      staleSteps: [],
      failedSteps: [],
      hasFreshLease: false,
      hasFreshRunningStep: false,
    };
  }

  const steps = formalSteps(session.runSteps || []);
  const staleSteps = steps.filter((step) => isRunStepStale(step, nowMs));
  const failedSteps = steps.filter((step) => step.status === "failed" || step.status === "stale");
  const hasFreshRunningStep = steps.some((step) => step.status === "running" && !isRunStepStale(step, nowMs));
  const hasFreshLease = isFreshFormalResumeLease(state.resumeLease, nowMs);
  const nextStep = nextFormalStep(session, state);

  if (state.phase === "complete" && state.verdict && !nextStep) {
    return { canResume: false, reason: "Formal Board Review is already complete.", staleSteps, failedSteps, hasFreshLease, hasFreshRunningStep };
  }
  if (hasFreshLease) {
    return { canResume: false, reason: "A fresh formal resume lease is already active.", nextStep, staleSteps, failedSteps, hasFreshLease, hasFreshRunningStep };
  }
  if (hasFreshRunningStep) {
    return { canResume: false, reason: "A formal run step is still active.", nextStep, staleSteps, failedSteps, hasFreshLease, hasFreshRunningStep };
  }
  if (!nextStep) {
    return { canResume: false, reason: "No safe Formal Board step is available to resume.", staleSteps, failedSteps, hasFreshLease, hasFreshRunningStep };
  }

  return { canResume: true, reason: "Formal Board Review can resume from the next missing step.", nextStep, staleSteps, failedSteps, hasFreshLease, hasFreshRunningStep };
}

export function hasCompletedRoundArtifact(state: FormalBoardState, round: 1 | 2 | 3, agentId: string) {
  return state.rounds.some((artifact: FormalBoardRoundArtifact) =>
    artifact.round === round &&
    artifact.agentId === agentId &&
    artifact.status === "ran"
  );
}
