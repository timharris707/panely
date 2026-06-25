import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveCliThinkingCapability,
  fallbackCliThinkingCapability,
  normalizeCliThinkingLevel,
  parseSupportedEffortLevels,
} from "./cli-capabilities.ts";

test("parses Claude help effort levels without inventing xhigh", () => {
  const help = `
Usage: claude [options]
  --effort <level>  Set reasoning effort. It must be one of: low, medium, high, max
`;

  assert.deepEqual(parseSupportedEffortLevels(help), ["low", "medium", "high", "max"]);

  const capability = deriveCliThinkingCapability({ command: "claude", helpText: help, checkedAt: "2026-06-25T00:00:00.000Z" });
  assert.deepEqual(capability.supportedThinkingLevels, ["low", "medium", "high", "max"]);
  assert.equal(capability.thinkingEnforced, true);
  assert.match(capability.thinkingEvidence, /verified/i);
});

test("normalizes unsupported Claude xhigh to max", () => {
  const capability = fallbackCliThinkingCapability("claude", "2026-06-25T00:00:00.000Z");
  const normalized = normalizeCliThinkingLevel("xhigh", capability);

  assert.equal(normalized.enforced, true);
  assert.equal(normalized.effective, "max");
  assert.equal(normalized.normalized, true);
  assert.match(normalized.note, /using max/i);
});

test("Gemini fallback does not claim enforceable thinking", () => {
  const capability = fallbackCliThinkingCapability("gemini", "2026-06-25T00:00:00.000Z");
  const normalized = normalizeCliThinkingLevel("high", capability);

  assert.deepEqual(capability.supportedThinkingLevels, []);
  assert.equal(capability.thinkingEnforced, false);
  assert.equal(normalized.enforced, false);
  assert.equal(normalized.effective, undefined);
});
