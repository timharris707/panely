import test from "node:test";
import assert from "node:assert/strict";
import { buildRequestedModelProvenance, formatModelProvenance } from "./provenance.ts";

test("requested-only provenance avoids overclaiming observed model", () => {
  const provenance = buildRequestedModelProvenance("gemini-pro");
  assert.equal(provenance.requestedModelId, "gemini-pro");
  assert.equal(provenance.verificationStatus, "requested-only");
  assert.match(formatModelProvenance(provenance), /Observed model not reported/);
});

test("reported provenance includes observed model", () => {
  const provenance = buildRequestedModelProvenance("claude-sonnet", "claude:claude-sonnet-4-6");
  assert.equal(provenance.verificationStatus, "reported-by-cli");
  assert.match(formatModelProvenance(provenance), /Observed: claude:claude-sonnet-4-6/);
});

test("unqualified fallback model names are not treated as observed CLI reports", () => {
  const provenance = buildRequestedModelProvenance("claude-sonnet", "claude-sonnet");
  assert.equal(provenance.requestedModelId, "claude-sonnet");
  assert.equal(provenance.observedModel, undefined);
  assert.equal(provenance.verificationStatus, "requested-only");

  const routerFallback = buildRequestedModelProvenance("gemini-pro", "model-router");
  assert.equal(routerFallback.requestedModelId, "gemini-pro");
  assert.equal(routerFallback.observedModel, undefined);
  assert.equal(routerFallback.verificationStatus, "requested-only");
});

test("provenance resolves local CLI source strings", () => {
  const provenance = buildRequestedModelProvenance("claude:claude-sonnet-4-6");
  assert.equal(provenance.requestedModelId, "claude-sonnet");
  assert.equal(provenance.requestedModel, "claude-sonnet-4-6");
});
