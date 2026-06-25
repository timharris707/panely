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
