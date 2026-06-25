import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildSourcePacket } from "./source-packet.ts";
import { formalVerdictArtifactName, renderFormalConsensusHtml } from "./formal-artifacts.ts";
import {
  buildFormalRoundOneUserPrompt,
  buildFormalVerdict,
  canRunFormalBoard,
  createFormalBoardState,
  markFormalSeat,
  recordFormalRoundArtifact,
} from "./formal-board.ts";

const ADVISORY_BOARD_VERDICT_VALIDATOR = path.join(
  homedir(),
  ".codex",
  "skills",
  "advisory-board",
  "scripts",
  "board_verdict.py"
);

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
  assert.equal(verdict.confidence, "low");
  assert.equal(verdict.rounds, 2);
  assert.equal(verdict.valid, true);
  assert.deepEqual(verdict.sameSeatContinuity, ["A", "B"]);
  assert.equal(verdict.board.filter((seat) => !seat.dropped).length, 2);
  assert.equal(verdict.board.find((seat) => seat.seat === "C")?.verdictsEstimated, true);
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
  assert.match(verdict.validityReason || "", /same seats/);
});

test("formal verdict is invalid when different seats complete each round", () => {
  const sourcePacket = buildSourcePacket({ topic: "Review the plan" });
  let state = createFormalBoardState({
    sessionId: "session-test",
    agents: ["A", "B", "C"],
    sourcePacket,
  });
  state = recordFormalRoundArtifact(state, { round: 1, agentId: "A", status: "ran", text: "## Verdict\nCAUTION" });
  state = recordFormalRoundArtifact(state, { round: 1, agentId: "B", status: "ran", text: "## Verdict\nCAUTION" });
  state = recordFormalRoundArtifact(state, { round: 2, agentId: "B", status: "ran", text: "## Verdict\nCAUTION" });
  state = recordFormalRoundArtifact(state, { round: 2, agentId: "C", status: "ran", text: "## Verdict\nCAUTION" });

  const verdict = buildFormalVerdict({
    topic: "Review the plan",
    state,
    synthesisText: "## Verdict\nCAUTION",
  });

  assert.equal(verdict.valid, false);
  assert.deepEqual(verdict.sameSeatContinuity, ["B"]);
  assert.equal(verdict.board.filter((seat) => !seat.dropped).length, 1);
  assert.equal(formalVerdictArtifactName(verdict), "panely-invalid-verdict.json");
});

test("formal verdict validates with the Advisory Board skill schema gate", { skip: !existsSync(ADVISORY_BOARD_VERDICT_VALIDATOR) }, () => {
  const sourcePacket = buildSourcePacket({ topic: "Review the plan" });
  let state = createFormalBoardState({
    sessionId: "session-test",
    agents: ["A", "B"],
    sourcePacket,
  });
  for (const round of [1, 2] as const) {
    state = recordFormalRoundArtifact(state, { round, agentId: "A", status: "ran", text: "## Verdict\nCAUTION" });
    state = recordFormalRoundArtifact(state, { round, agentId: "B", status: "ran", text: "## Verdict\nCAUTION" });
  }

  const verdict = buildFormalVerdict({
    topic: "Review the plan",
    state,
    synthesisText: "## Verdict\nCAUTION\n\n## Evidence-backed\n- Tests exist.\n\n## Next actions\n- Stage the rollout.",
  });
  const dir = mkdtempSync(path.join(tmpdir(), "panely-verdict-"));
  const verdictPath = path.join(dir, "verdict.json");
  writeFileSync(verdictPath, JSON.stringify(verdict, null, 2));

  const result = spawnSync("python3", [ADVISORY_BOARD_VERDICT_VALIDATOR, verdictPath], { encoding: "utf-8" });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("formal consensus HTML is self-contained and placeholder-free", () => {
  const sourcePacket = buildSourcePacket({ topic: "Review the plan" });
  let state = createFormalBoardState({
    sessionId: "session-test",
    agents: ["A", "B"],
    sourcePacket,
  });
  for (const round of [1, 2] as const) {
    state = recordFormalRoundArtifact(state, { round, agentId: "A", status: "ran", text: "## Verdict\nCAUTION" });
    state = recordFormalRoundArtifact(state, { round, agentId: "B", status: "ran", text: "## Verdict\nCAUTION" });
  }
  const finalConsensusMarkdown = "## Verdict\nCAUTION\n\n## Evidence-backed\n- Tests exist.";
  const verdict = buildFormalVerdict({ topic: "Review the plan", state, synthesisText: finalConsensusMarkdown });

  const html = renderFormalConsensusHtml({
    title: "Review the plan",
    topic: "Review the plan",
    state,
    verdict,
    finalConsensusMarkdown,
  });

  assert.doesNotMatch(html, /\{\{[^}]+\}\}/);
  assert.doesNotMatch(html, /<script\b|<link\b|\b(?:src|href)=["']https?:\/\//i);
  assert.match(html, /Formal Board Review/);
  assert.equal(formalVerdictArtifactName(verdict), "verdict.json");
});
