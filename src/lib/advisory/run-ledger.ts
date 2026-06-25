import type { AdvisoryRunStep } from "../../types/advisory.ts";
import { buildRequestedModelProvenance } from "./provenance.ts";

const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1000;

export function createRunStep(input: {
  sessionId: string;
  index: number;
  phase: string;
  agentId: string;
  model: string;
  attemptId?: string;
  now?: string;
}): AdvisoryRunStep {
  const now = input.now || new Date().toISOString();
  return {
    id: `step_${input.sessionId}_${input.index}_${input.phase}_${input.agentId}_${Date.now()}`,
    sessionId: input.sessionId,
    index: input.index,
    phase: input.phase,
    agentId: input.agentId,
    model: input.model,
    status: "running",
    attemptId: input.attemptId,
    startedAt: now,
    heartbeatAt: now,
    provenance: buildRequestedModelProvenance(input.model),
  };
}

export function touchRunStep(step: AdvisoryRunStep, now = new Date().toISOString()): AdvisoryRunStep {
  return { ...step, heartbeatAt: now };
}

export function completeRunStep(step: AdvisoryRunStep, now = new Date().toISOString()): AdvisoryRunStep {
  return { ...step, status: "done", completedAt: now, heartbeatAt: now };
}

export function failRunStep(step: AdvisoryRunStep, error: { errorKind?: string; error?: string }, now = new Date().toISOString()): AdvisoryRunStep {
  return {
    ...step,
    status: "failed",
    completedAt: now,
    heartbeatAt: now,
    errorKind: error.errorKind,
    error: error.error,
  };
}

export function isRunStepStale(step: AdvisoryRunStep, nowMs = Date.now(), staleAfterMs = DEFAULT_STALE_AFTER_MS) {
  if (step.status !== "running") return false;
  const heartbeatMs = Date.parse(step.heartbeatAt || step.startedAt || "");
  return Number.isFinite(heartbeatMs) && nowMs - heartbeatMs > staleAfterMs;
}

export function markStaleRunSteps(steps: AdvisoryRunStep[] = [], nowMs = Date.now(), staleAfterMs = DEFAULT_STALE_AFTER_MS) {
  return steps.map((step) =>
    isRunStepStale(step, nowMs, staleAfterMs)
      ? {
          ...step,
          status: "stale" as const,
          errorKind: step.errorKind || "timeout",
          error: step.error || "This run step appears stale. The local process may have stopped before completing it.",
        }
      : step
  );
}

export function hasStaleRunSteps(steps: AdvisoryRunStep[] = [], nowMs = Date.now(), staleAfterMs = DEFAULT_STALE_AFTER_MS) {
  return steps.some((step) => isRunStepStale(step, nowMs, staleAfterMs));
}

export function getActiveStaleRunSteps(steps: AdvisoryRunStep[] = [], nowMs = Date.now(), staleAfterMs = DEFAULT_STALE_AFTER_MS) {
  return steps.filter((step) => isRunStepStale(step, nowMs, staleAfterMs));
}
