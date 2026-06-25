import assert from "node:assert/strict";
import test from "node:test";
import { validateSessionPlanProviderDisclosure } from "../../../../lib/advisory/provider-disclosure-gates.ts";

test("session planner blocks unknown source material before planner calls without disclosure", () => {
  const result = validateSessionPlanProviderDisclosure({
    topic: "Review this private launch plan",
    attachedFileCount: 1,
    modelId: "claude-sonnet",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.plannerDisclosure.requiresConsent, true);
});

test("session planner disclosure helper allows public GitHub URLs", () => {
  const result = validateSessionPlanProviderDisclosure({
    topic: "Review https://github.com/timharris707/panely",
    modelId: "claude-sonnet",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.plannerDisclosure.sensitivity, "public");
  assert.equal(result.plannerDisclosure.requiresConsent, false);
});
