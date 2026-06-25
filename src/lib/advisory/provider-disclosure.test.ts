import test from "node:test";
import assert from "node:assert/strict";
import { buildProviderDisclosure, inferSourceSensitivity, providerLabelsForModelIds } from "./provider-disclosure.ts";

test("public URLs do not require disclosure consent", () => {
  assert.equal(inferSourceSensitivity({ topic: "https://github.com/timharris707/panely" }), "public");
  assert.equal(inferSourceSensitivity({ topic: "Review https://github.com/timharris707/panely" }), "public");
  const disclosure = buildProviderDisclosure({
    topic: "https://github.com/timharris707/panely",
    modelIds: ["claude-sonnet", "codex-frontier"],
  });
  assert.equal(disclosure.requiresConsent, false);
});

test("mixed private text and public URLs require disclosure consent", () => {
  assert.equal(
    inferSourceSensitivity({
      topic: "Our unannounced Q4 launch numbers are 12345; compare https://github.com/timharris707/panely",
    }),
    "unknown"
  );
  const disclosure = buildProviderDisclosure({
    topic: "Our unannounced Q4 launch numbers are 12345; compare https://github.com/timharris707/panely",
    modelIds: ["claude-sonnet"],
  });
  assert.equal(disclosure.requiresConsent, true);
});

test("arbitrary URLs require disclosure consent", () => {
  assert.equal(inferSourceSensitivity({ topic: "https://example.com/private-doc?token=secret" }), "unknown");
  const disclosure = buildProviderDisclosure({
    topic: "https://example.com/private-doc?token=secret",
    modelIds: ["claude-sonnet"],
  });
  assert.equal(disclosure.requiresConsent, true);
});

test("attached files are treated as unknown sensitivity", () => {
  const disclosure = buildProviderDisclosure({
    topic: "Review this plan",
    attachedFileCount: 1,
    planningModelIds: ["claude-sonnet"],
    modelIds: ["gemini-flash"],
  });
  assert.equal(disclosure.sensitivity, "unknown");
  assert.equal(disclosure.requiresConsent, true);
  assert.deepEqual(disclosure.providers, ["Anthropic / Claude", "Google / Gemini"]);
});

test("provider labels are deduplicated by provider", () => {
  assert.deepEqual(providerLabelsForModelIds(["claude-opus", "claude-sonnet", "codex-frontier"]), [
    "Anthropic / Claude",
    "OpenAI / Codex",
  ]);
});
