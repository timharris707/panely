import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTopIdeasFromTally,
  filterBlindVoteEvents,
  parseCompetitiveVote,
  parseTopIdeaVotes,
  registerTopIdeaVote,
} from "./competitive.ts";

test("parseTopIdeaVotes extracts ranked top idea votes", () => {
  const votes = parseTopIdeaVotes(
    `**VOTE 1: Session Engine**\n**VOTE 2: Decision Record**\n**VOTE 3: Run Ledger**\nReasoning follows.`,
    3
  );
  assert.deepEqual(votes, ["Session Engine", "Decision Record", "Run Ledger"]);
});

test("registerTopIdeaVote normalizes duplicate labels", () => {
  const tally: Record<string, number> = {};
  registerTopIdeaVote(tally, "Session Engine");
  registerTopIdeaVote(tally, "session-engine!");
  registerTopIdeaVote(tally, "Decision Record");
  assert.deepEqual(tally, { "Session Engine": 2, "Decision Record": 1 });
  assert.deepEqual(buildTopIdeasFromTally(tally, 2), [
    { idea: "Session Engine", votes: 2, rank: 1 },
    { idea: "Decision Record", votes: 1, rank: 2 },
  ]);
});

test("parseCompetitiveVote rejects self by matching eligible agents only", () => {
  assert.equal(parseCompetitiveVote("**VOTE: Alice**\nAlice had the best pitch.", "Alice", ["Alice", "Bob"]), "Alice");
  assert.equal(parseCompetitiveVote("**VOTE: Bo**", "Alice", ["Alice", "Bob"]), "Bob");
});

test("filterBlindVoteEvents removes prior vote events", () => {
  const events = [
    { id: "evt_pitch_a" },
    { id: "evt_vote_a" },
    { id: "evt_critique_a" },
    { id: "evt_vote_b" },
  ];
  assert.deepEqual(filterBlindVoteEvents(events), [{ id: "evt_pitch_a" }, { id: "evt_critique_a" }]);
});
