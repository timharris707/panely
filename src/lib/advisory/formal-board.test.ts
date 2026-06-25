import assert from "node:assert/strict";
import test from "node:test";
import { buildSourcePacket } from "./source-packet.ts";
import {
  buildFormalRoundOneUserPrompt,
  buildFormalVerdict,
  canRunFormalBoard,
  createFormalBoardState,
  markFormalSeat,
  recordFormalRoundArtifact,
} from "./formal-board.ts";

test("formal board requires at least two runnable seats", () => {
  const sourcePacket = buildSourcePacket({ topic: "Review the plan" });
  const state = createFormalBoardState({
    sessionId: "session-test",
    agents: ["A", "B"],
    sourcePacket,
  });

  assert.equal(canRunFormalBoard(state), true);
  assert.equal(canRunFormalBoard(markFormalSeat(state, "B", "dropped", "provider unavailable")), false);
});

test("round one prompt contains source packet but not peer output", () => {
  const sourcePacket = buildSourcePacket({ topic: "Review the plan", referenceContext: "Source packet body" });
  const prompt = buildFormalRoundOneUserPrompt(sourcePacket);

  assert.match(prompt, /Source packet SHA-256/);
  assert.match(prompt, /Source packet body/);
  assert.doesNotMatch(prompt, /Round 1 board packet/);
  assert.doesNotMatch(prompt, /other reviewers/i);
});

test("formal verdict records dropped and degraded seats", () => {
  const sourcePacket = buildSourcePacket({ topic: "Review the plan" });
  let state = createFormalBoardState({
    sessionId: "session-test",
    agents: ["A", "B", "C"],
    sourcePacket,
  });
  state = recordFormalRoundArtifact(state, {
    round: 1,
    agentId: "A",
    status: "ran",
    text: "Evidence-backed: the plan has tests.",
  });
  state = recordFormalRoundArtifact(state, {
    round: 1,
    agentId: "B",
    status: "ran",
    text: "Judgment call: ship with caution.",
  });
  state = recordFormalRoundArtifact(state, {
    round: 2,
    agentId: "A",
    status: "ran",
    text: "Final verdict: caution.",
  });
  state = recordFormalRoundArtifact(state, {
    round: 2,
    agentId: "B",
    status: "ran",
    text: "Final verdict: caution.",
  });
  state = markFormalSeat(state, "C", "degraded", "timeout");

  const verdict = buildFormalVerdict({
    topic: "Review the plan",
    state,
    synthesisText: "## Verdict\nCAUTION\n\n## Could not verify\n- unknown deployment path\n\n## Minority report\n- dissent on scope",
  });

  assert.equal(verdict.schema, "advisory-board/verdict@1");
  assert.equal(verdict.verdict, "caution");
  assert.equal(verdict.valid, true);
  assert.deepEqual(verdict.degradedSeats, [{ agentId: "C", reason: "timeout" }]);
});

test("formal verdict parses explicit verdict section without whole-text override", () => {
  const sourcePacket = buildSourcePacket({ topic: "Review the plan" });
  let state = createFormalBoardState({
    sessionId: "session-test",
    agents: ["A", "B"],
    sourcePacket,
  });
  for (const round of [1, 2] as const) {
    state = recordFormalRoundArtifact(state, { round, agentId: "A", status: "ran", text: "ok" });
    state = recordFormalRoundArtifact(state, { round, agentId: "B", status: "ran", text: "ok" });
  }

  const verdict = buildFormalVerdict({
    topic: "Review the plan",
    state,
    synthesisText: "## Verdict\nSHIP\nNo block remains after the fixes.\n\n## Risks\n- Watch rollout.",
  });

  assert.equal(verdict.verdict, "ship");
  assert.equal(verdict.valid, true);
});

test("formal verdict is invalid when rebuttal round has fewer than two successful seats", () => {
  const sourcePacket = buildSourcePacket({ topic: "Review the plan" });
  let state = createFormalBoardState({
    sessionId: "session-test",
    agents: ["A", "B"],
    sourcePacket,
  });
  state = recordFormalRoundArtifact(state, { round: 1, agentId: "A", status: "ran", text: "ok" });
  state = recordFormalRoundArtifact(state, { round: 1, agentId: "B", status: "ran", text: "ok" });
  state = recordFormalRoundArtifact(state, { round: 2, agentId: "A", status: "ran", text: "ok" });

  const verdict = buildFormalVerdict({
    topic: "Review the plan",
    state,
    synthesisText: "## Verdict\nSHIP",
  });

  assert.equal(verdict.valid, false);
  assert.match(verdict.validityReason || "", /Round 2/);
});
