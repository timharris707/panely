import test from "node:test";
import assert from "node:assert/strict";
import {
  countCompletedRoundtableRounds,
  determineNextRoundtableAgent,
  isRoundLimitReached,
} from "./engine.ts";

test("determineNextRoundtableAgent returns first missing agent in current round", () => {
  const result = determineNextRoundtableAgent(
    ["A", "B", "C"],
    [
      { speaker: "A", type: "worker" },
      { speaker: "B", type: "worker" },
    ]
  );
  assert.deepEqual(result, { agentId: "C", isNewRound: false });
});

test("determineNextRoundtableAgent starts a new round after all agents speak", () => {
  const result = determineNextRoundtableAgent(
    ["A", "B"],
    [
      { speaker: "A", type: "worker" },
      { speaker: "B", type: "worker" },
    ]
  );
  assert.deepEqual(result, { agentId: "A", isNewRound: true });
});

test("countCompletedRoundtableRounds and limit check use content turns", () => {
  const completed = countCompletedRoundtableRounds(
    ["A", "B"],
    [
      { speaker: "System", type: "start" },
      { speaker: "A", type: "worker" },
      { speaker: "B", type: "worker" },
      { speaker: "A", type: "worker" },
    ]
  );
  assert.equal(completed, 1);
  assert.equal(isRoundLimitReached(1, completed), true);
  assert.equal(isRoundLimitReached("persistent", completed), false);
});
