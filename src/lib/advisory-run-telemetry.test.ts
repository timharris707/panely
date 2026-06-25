import test from "node:test";
import assert from "node:assert/strict";
import { finishRunAttempt, startRunAttempt } from "./advisory-run-telemetry.ts";

test("run attempts create and complete run ledger steps", () => {
  const session: Record<string, unknown> = { id: "session-test" };
  const attempt = startRunAttempt(session, {
    phase: "competitive-vote",
    agentId: "Agent",
    model: "claude-sonnet",
  });

  const stepsAfterStart = session.runSteps as Array<{ attemptId?: string; status: string }>;
  assert.equal(stepsAfterStart.length, 1);
  assert.equal(stepsAfterStart[0].attemptId, attempt.id);
  assert.equal(stepsAfterStart[0].status, "running");

  finishRunAttempt(session, attempt.id, {
    status: "succeeded",
    modelSource: "claude:claude-sonnet-4-6",
  });

  const stepsAfterFinish = session.runSteps as Array<{ status: string; provenance?: { observedModel?: string } }>;
  assert.equal(stepsAfterFinish[0].status, "done");
  assert.equal(stepsAfterFinish[0].provenance?.observedModel, "claude:claude-sonnet-4-6");
});
