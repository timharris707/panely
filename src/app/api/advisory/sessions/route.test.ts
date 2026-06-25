import assert from "node:assert/strict";
import test from "node:test";
import { buildSessionProviderDisclosureForRequest } from "../../../../lib/advisory/provider-disclosure-gates.ts";

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
