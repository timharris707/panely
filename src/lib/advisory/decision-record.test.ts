import test from "node:test";
import assert from "node:assert/strict";
import type { AdvisorySession } from "../../types/advisory.ts";
import { buildDecisionRecord } from "./decision-record.ts";

test("buildDecisionRecord preserves competitive top ideas and transcript", () => {
  const session: AdvisorySession = {
    id: "session-test",
    topic: "Improve Panely",
    mode: "competitive",
    agents: ["A", "B"],
    status: "completed",
    createdAt: "2026-06-25T09:00:00.000Z",
    competitive: {
      phase: "complete",
      voteMode: "top-ideas",
      topCount: 3,
      pitches: {},
      votes: [{ voter: "A", votedFor: "Session Engine", reasoning: "Best leverage" }],
      winner: "Session Engine",
      voteTally: { "Session Engine": 2, "Decision Record": 1 },
      topIdeas: [
        { idea: "Session Engine", votes: 2 },
        { idea: "Decision Record", votes: 1 },
      ],
    },
    events: [
      {
        id: "evt_1",
        timestamp: "2026-06-25T09:01:00.000Z",
        type: "complete",
        speaker: "A",
        emoji: "A",
        role: "worker",
        text: "Final answer with risk and action item.",
        model: "claude:claude-sonnet-4-6",
      },
    ],
  };

  const record = buildDecisionRecord(session);
  assert.equal(record.status, "complete");
  assert.equal(record.optionsConsidered[0].title, "Session Engine");
  assert.equal(record.voteMode, "top-ideas");
  assert.match(record.markdown, /Full Transcript/);
  assert.match(record.markdown, /Model Provenance/);
});

test("buildDecisionRecord includes formal board verdict artifact", () => {
  const session: AdvisorySession = {
    id: "session-formal",
    topic: "Review the release plan",
    mode: "formal-board",
    agents: ["A", "B"],
    status: "completed",
    createdAt: "2026-06-25T09:00:00.000Z",
    formalBoard: {
      protocol: "advisory-board/formal@1",
      phase: "complete",
      sourcePacketHash: "abc123",
      sourcePacketPreview: "Review the release plan",
      seats: [
        { agentId: "A", status: "ran", roundsCompleted: 2 },
        { agentId: "B", status: "ran", roundsCompleted: 2 },
      ],
      rounds: [],
      verdict: {
        schema: "advisory-board/verdict@1",
        title: "Review the release plan",
        date: "2026-06-25",
        verdict: "caution",
        confidence: "medium",
        unanimous: true,
        rounds: 2,
        board: [
          { seat: "A", model: "claude-sonnet-4-6", lens: "reviewer", round_verdicts: ["caution", "caution"], dropped: false },
          { seat: "B", model: "gpt-5.5", lens: "reviewer", round_verdicts: ["caution", "caution"], dropped: false },
        ],
        blockers: [],
        dissent: [{ who: "B", body: "One reviewer wanted to block until load testing." }],
        open_questions: ["Production load is unknown."],
        next_actions: ["OS breakdown of current users** Pull telemetry before committing.", "CAUTION before launch by verifying telemetry.", "Run a staged rollout."],
        summary: "## Verdict\nCAUTION. Ship with a scoped rollout.",
        evidenceBacked: ["## Evidence-backed", "Tests exist."],
        judgmentCalls: ["## Judgment calls", "Rollout should be staged."],
        couldntVerify: ["## Could not verify", "Production load is unknown."],
        minorityReport: ["## Minority report", "One reviewer wanted to block until load testing."],
        droppedSeats: [],
        degradedSeats: [],
        valid: true,
        sameSeatContinuity: ["A", "B"],
        synthesisNeutrality: "neutral-clerk",
        synthesisProducer: "formal-board-clerk",
      },
    },
    events: [],
  };

  const record = buildDecisionRecord(session);
  assert.equal(record.formalVerdict?.schema, "advisory-board/verdict@1");
  assert.equal(record.optionsConsidered[0].title, "CAUTION");
  assert.equal(record.optionsConsidered[0].summary, "Ship with a scoped rollout.");
  assert.match(record.markdown, /Formal Board Verdict/);
  assert.doesNotMatch(record.markdown, /CAUTION: ## Verdict/);
  assert.match(record.markdown, /Production load is unknown/);
  assert.match(record.markdown, /- \*\*OS breakdown of current users\*\* Pull telemetry before committing\./);
  assert.match(record.markdown, /- CAUTION before launch by verifying telemetry\./);
  assert.doesNotMatch(record.markdown, /(^|\n)- OS breakdown of current users\*\* Pull/);
  assert.doesNotMatch(record.markdown, /- ## (?:Evidence-backed|Judgment calls|Could not verify|Minority report)/i);
});
