import test from "node:test";
import assert from "node:assert/strict";
import { buildCliUpdateInvocation } from "./model-health.ts";

test("CLI update invocation uses fixed commands without shell strings", () => {
  assert.deepEqual(buildCliUpdateInvocation("claude", { installMethod: "npm" }), {
    command: "npm",
    args: ["install", "-g", "@anthropic-ai/claude-code@latest"],
  });
  assert.deepEqual(buildCliUpdateInvocation("gemini", { installMethod: "homebrew" }), {
    command: "brew",
    args: ["upgrade", "gemini-cli"],
  });
  assert.deepEqual(buildCliUpdateInvocation("agy", { installMethod: "homebrew-cask" }), {
    command: "agy",
    args: ["update"],
  });
});
