import { classifyProviderError } from "./ai/provider-errors.ts";
import { completeRunStep, createRunStep, failRunStep } from "./advisory/run-ledger.ts";
import { buildRequestedModelProvenance } from "./advisory/provenance.ts";
import type { AdvisoryRunAttempt, AdvisoryRunStep } from "../types/advisory.ts";

export interface RunAttemptStartInput {
  phase: string;
  agentId: string;
  model: string;
}

export function startRunAttempt(session: Record<string, unknown>, input: RunAttemptStartInput) {
  const attempts = Array.isArray(session.runAttempts)
    ? (session.runAttempts as AdvisoryRunAttempt[])
    : [];
  const agentAttempts = attempts.filter(
    (attempt) => attempt.agentId === input.agentId && attempt.phase === input.phase
  );
  const now = new Date().toISOString();
  const attempt: AdvisoryRunAttempt = {
    id: `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    phase: input.phase,
    agentId: input.agentId,
    model: input.model,
    status: "running",
    startedAt: now,
    attempt: agentAttempts.length + 1,
  };
  session.runAttempts = [...attempts, attempt];
  const steps = Array.isArray(session.runSteps)
    ? (session.runSteps as AdvisoryRunStep[])
    : [];
  session.runSteps = [
    ...steps,
    createRunStep({
      sessionId: typeof session.id === "string" ? session.id : "unknown-session",
      index: steps.length + 1,
      phase: input.phase,
      agentId: input.agentId,
      model: input.model,
      attemptId: attempt.id,
      now,
    }),
  ];
  session.activeRunAttempt = attempt;
  return attempt;
}

export function finishRunAttempt(
  session: Record<string, unknown>,
  attemptId: string,
  update: { status: "succeeded"; modelSource?: string } | { status: "failed"; error: unknown }
) {
  const attempts = Array.isArray(session.runAttempts)
    ? (session.runAttempts as AdvisoryRunAttempt[])
    : [];
  const steps = Array.isArray(session.runSteps)
    ? (session.runSteps as AdvisoryRunStep[])
    : [];
  const completedAt = new Date().toISOString();
  const originalAttempt = attempts.find((attempt) => attempt.id === attemptId);
  session.runAttempts = attempts.map((attempt) => {
    if (attempt.id !== attemptId) return attempt;
    const durationMs = new Date(completedAt).getTime() - new Date(attempt.startedAt).getTime();
    if (update.status === "succeeded") {
      return {
        ...attempt,
        status: "succeeded" as const,
        completedAt,
        durationMs,
        modelSource: update.modelSource,
      };
    }
    const classified = classifyProviderError(update.error);
    return {
      ...attempt,
      status: "failed" as const,
      completedAt,
      durationMs,
      errorKind: classified.kind,
      error: classified.message,
    };
  });
  session.runSteps = steps.map((step) => {
    if (step.attemptId !== attemptId) return step;
    if (update.status === "succeeded") {
      return {
        ...completeRunStep(step, completedAt),
        provenance: buildRequestedModelProvenance(originalAttempt?.model || step.model, update.modelSource),
      };
    }
    const classified = classifyProviderError(update.error);
    return failRunStep(step, { errorKind: classified.kind, error: classified.message }, completedAt);
  });
  delete session.activeRunAttempt;
  return (session.runAttempts as AdvisoryRunAttempt[]).find((attempt) => attempt.id === attemptId) || null;
}

export function summarizeRunAttempts(session: Record<string, unknown>) {
  const attempts = Array.isArray(session.runAttempts)
    ? (session.runAttempts as AdvisoryRunAttempt[])
    : [];
  return attempts.map((attempt) => ({
    agent: attempt.agentId,
    model: attempt.modelSource || attempt.model,
    status: attempt.status,
    durationMs: attempt.durationMs,
  }));
}
