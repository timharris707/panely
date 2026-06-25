import assert from "node:assert/strict";
import test from "node:test";
import { inferAdvisoryIntent, inferAdvisoryMode } from "./session-intent.ts";

test("inferAdvisoryIntent detects developer debugging requests", () => {
  assert.equal(inferAdvisoryIntent("I have a failing test and a stack trace in checkout.ts"), "debug");
  assert.equal(inferAdvisoryIntent("The build failed with a TypeScript error"), "debug");
  assert.equal(inferAdvisoryIntent("Find the root cause of this regression"), "debug");
});

test("inferAdvisoryMode routes debug work to formal board unless exploratory", () => {
  assert.equal(inferAdvisoryMode("debug", "failing test in local repo"), "formal-board");
  assert.equal(inferAdvisoryMode("debug", "quick exploratory debugging chat"), "roundtable");
});
