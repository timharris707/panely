import assert from "node:assert/strict";
import test from "node:test";
import { buildSessionProviderDisclosureForRequest } from "../../../../lib/advisory/provider-disclosure-gates.ts";
import { buildLocalProjectStartSummary } from "../../../../lib/advisory/local-project-summary.ts";

test("session creation blocks unknown source material before preflight without disclosure", () => {
  const result = buildSessionProviderDisclosureForRequest({
    topic: "Review this private plan",
    mode: "formal-board",
    agents: ["A", "B"],
    referenceContext: "# Private plan\nDo not share broadly.",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.disclosure.requiresConsent, true);
});

test("session creation disclosure helper persists accepted disclosure metadata", () => {
  const result = buildSessionProviderDisclosureForRequest({
    topic: "Review this private plan",
    referenceContext: "# Private plan",
    model: "claude-sonnet",
    providerDisclosure: {
      accepted: true,
      acceptedAt: "2026-06-25T11:30:00.000Z",
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.persisted.accepted, true);
  assert.equal(result.persisted.acceptedAt, "2026-06-25T11:30:00.000Z");
  assert.equal(result.persisted.sensitivity, "unknown");
  assert.ok(result.persisted.providers.includes("Anthropic / Claude"));
});

test("session creation treats local project packets as non-public", () => {
  const result = buildSessionProviderDisclosureForRequest({
    topic: "Debug this project",
    referenceContext: "# Local Project Debug Packet",
    model: "claude-sonnet",
    sourceKinds: ["local-project"],
    localProjectFileCount: 2,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.disclosure.sensitivity, "non-public");
  assert.match(result.disclosure.message, /local project source is non-public/i);
});

test("session start summary reports local project packets without absolute paths", () => {
  const summary = buildLocalProjectStartSummary(["local-project"], 7);

  assert.match(summary, /Local project packet/);
  assert.match(summary, /7 files selected/);
  assert.match(summary, /Absolute local path redacted/);
  assert.equal(summary.includes("/Users/"), false);
});
