import { classifyProviderError } from "@/lib/ai/provider-errors";
import type { AdvisoryRunAttempt } from "@/types/advisory";

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
  const completedAt = new Date().toISOString();
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
