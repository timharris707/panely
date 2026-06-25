import test from "node:test";
import assert from "node:assert/strict";
import { getProviderModelById } from "./providers.ts";
import { codexReasoningEffortArgs, resolveThinkingLevel, supportedThinkingLevels } from "./thinking-levels.ts";

test("Claude thinking levels are enforceable through the local CLI", () => {
  const model = getProviderModelById("claude-opus");
  assert.deepEqual(supportedThinkingLevels(model), ["low", "medium", "high", "xhigh", "max"]);

  const resolved = resolveThinkingLevel(model, "xhigh");
  assert.equal(resolved.enforced, true);
  assert.equal(resolved.effective, "xhigh");
  assert.equal(resolved.normalized, false);
});

test("Codex reasoning effort maps to config args", () => {
  const model = getProviderModelById("codex-frontier");
  const resolved = resolveThinkingLevel(model, "max");
  assert.deepEqual(codexReasoningEffortArgs(resolved), ["--config", "model_reasoning_effort=\"max\""]);
});

test("Gemini thinking level is not overclaimed when CLI has no stable flag", () => {
  const model = getProviderModelById("gemini-flash");
  assert.deepEqual(supportedThinkingLevels(model), []);

  const resolved = resolveThinkingLevel(model, "high");
  assert.equal(resolved.enforced, false);
  assert.equal(resolved.effective, undefined);
  assert.match(resolved.note, /not enforced/i);
});
