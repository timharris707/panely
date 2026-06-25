import test from "node:test";
import assert from "node:assert/strict";
import {
  completeRunStep,
  createRunStep,
  failRunStep,
  getActiveStaleRunSteps,
  hasStaleRunSteps,
  isRunStepStale,
  markStaleRunSteps,
} from "./run-ledger.ts";

test("run step stale detection only applies to running steps", () => {
  const step = createRunStep({
    sessionId: "session-test",
    index: 1,
    phase: "pitch",
    agentId: "Agent",
    model: "claude-sonnet",
    now: "2026-06-25T09:00:00.000Z",
  });

  assert.equal(isRunStepStale(step, Date.parse("2026-06-25T09:16:00.000Z")), true);
  assert.equal(isRunStepStale(completeRunStep(step, "2026-06-25T09:01:00.000Z"), Date.parse("2026-06-25T09:10:00.000Z")), false);
});

test("markStaleRunSteps marks stale steps without touching failures", () => {
  const running = createRunStep({
    sessionId: "session-test",
    index: 1,
    phase: "vote",
    agentId: "Agent",
    model: "gemini-pro",
    now: "2026-06-25T09:00:00.000Z",
  });
  const failed = failRunStep(running, { errorKind: "auth", error: "No auth" }, "2026-06-25T09:00:30.000Z");
  const marked = markStaleRunSteps([running, failed], Date.parse("2026-06-25T09:16:00.000Z"));
  assert.equal(marked[0].status, "stale");
  assert.equal(marked[1].status, "failed");
  assert.equal(hasStaleRunSteps(marked), false);
  assert.equal(getActiveStaleRunSteps([running], Date.parse("2026-06-25T09:16:00.000Z")).length, 1);
});
