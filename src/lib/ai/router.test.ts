import test from "node:test";
import assert from "node:assert/strict";
import { buildLocalCliCommand } from "./router.ts";

test("Claude command passes normalized effort", () => {
  const command = buildLocalCliCommand(
    { modelId: "claude-opus", prompt: "Review this", thinkingLevel: "max" },
    "claude",
    "claude-opus-4-8",
  );

  assert.equal(command.command, "claude");
  assert.deepEqual(command.args.slice(0, 6), ["-p", "--model", "claude-opus-4-8", "--effort", "max", "--tools"]);
});

test("Codex command passes model reasoning effort explicitly", () => {
  const command = buildLocalCliCommand(
    { modelId: "codex-frontier", prompt: "Review this", thinkingLevel: "xhigh" },
    "codex",
    "gpt-5.5",
    { outputFile: "/tmp/panely-last-message.txt" },
  );

  assert.equal(command.command, "codex");
  assert.ok(command.args.includes("--config"));
  assert.ok(command.args.includes("model_reasoning_effort=\"xhigh\""));
  assert.ok(command.args.includes("--output-last-message"));
  assert.ok(command.args.includes("/tmp/panely-last-message.txt"));
});

test("Gemini command does not include fake thinking flags", () => {
  const command = buildLocalCliCommand(
    { modelId: "gemini-flash", prompt: "Review this", thinkingLevel: "high" },
    "gemini",
    "gemini-3.5-flash",
  );

  assert.equal(command.command, "gemini");
  assert.deepEqual(command.args, [
    "--prompt",
    "",
    "--model",
    "gemini-3.5-flash",
    "--output-format",
    "text",
    "--approval-mode",
    "plan",
  ]);
  assert.equal(command.input, "Review this");
});
