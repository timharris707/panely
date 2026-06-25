import assert from "node:assert/strict";
import test from "node:test";
import { validateFormalBoardVerdict } from "./verdict-schema.ts";

const validVerdict = {
  schema: "advisory-board/verdict@1",
  verdict: "caution",
  confidence: "medium",
  unanimous: true,
  rounds: 2,
  board: [
    { seat: "A", model: "claude-opus-4-8", round_verdicts: ["caution", "caution"], dropped: false },
    { seat: "B", model: "gpt-5.5", round_verdicts: ["caution", "caution"], dropped: false },
  ],
};

test("built-in verdict schema accepts advisory-board/verdict@1", () => {
  const result = validateFormalBoardVerdict(validVerdict);
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("built-in verdict schema rejects missing required fields", () => {
  const result = validateFormalBoardVerdict({ schema: "advisory-board/verdict@1", verdict: "ship" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("confidence")));
  assert.ok(result.errors.some((error) => error.includes("board")));
  assert.ok(result.errors.some((error) => error.includes("rounds")));
});

test("built-in verdict schema rejects one-voice boards", () => {
  const result = validateFormalBoardVerdict({
    ...validVerdict,
    board: [
      { seat: "A", model: "claude-opus-4-8", round_verdicts: ["caution"], dropped: false },
      { seat: "B", model: "gpt-5.5", round_verdicts: ["caution"], dropped: true },
    ],
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("at least two")));
});

test("built-in verdict schema rejects false unanimity", () => {
  const result = validateFormalBoardVerdict({
    ...validVerdict,
    unanimous: true,
    board: [
      { seat: "A", model: "claude-opus-4-8", round_verdicts: ["ship"], dropped: false },
      { seat: "B", model: "gpt-5.5", round_verdicts: ["caution"], dropped: false },
    ],
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("unanimous")));
});
