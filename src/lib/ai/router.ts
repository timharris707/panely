import { spawn } from "child_process";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { getProviderModelById, type AIProvider } from "@/lib/ai/providers";
import { classifyProviderError } from "@/lib/ai/provider-errors";

export interface GenerateTextInput {
  prompt: string;
  modelId?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
  timeoutMs?: number;
  onTextChunk?: (chunk: string) => void;
}

export interface GenerateTextOutput {
  text: string;
  provider: AIProvider;
  modelId: string;
  model: string;
}

function runCommand(
  command: string,
  args: string[],
  input?: string,
  timeoutMs = 180000,
  onTextChunk?: (chunk: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      onTextChunk?.(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        const classified = classifyProviderError(`${command} exited with code ${code}: ${stderr.trim() || stdout.trim()}`);
        reject(new Error(`${classified.kind}: ${classified.message}`));
      }
    });

    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

function composePrompt(prompt: string, systemPrompt?: string) {
  return systemPrompt ? `System instructions:\n${systemPrompt}\n\nUser request:\n${prompt}` : prompt;
}

function normalizeClaudeEffort(thinkingLevel?: GenerateTextInput["thinkingLevel"]) {
  if (!thinkingLevel || thinkingLevel === "off" || thinkingLevel === "minimal") return "low";
  return thinkingLevel === "xhigh" ? "xhigh" : thinkingLevel;
}

async function generateWithLocalCli(input: GenerateTextInput, localCli: "claude" | "codex" | "gemini", model: string): Promise<string> {
  const prompt = composePrompt(input.prompt, input.systemPrompt);
  const derivedTimeoutMs = Math.max(120000, Math.min(300000, (input.maxTokens ?? 2048) * 60));
  const timeoutMs = input.timeoutMs
    ? Math.max(30000, Math.min(300000, input.timeoutMs))
    : derivedTimeoutMs;

  if (localCli === "claude") {
    // Claude CLI accepts the prompt as an argv tail and streams stdout directly.
    return runCommand(
      "claude",
      [
        "-p",
        "--model",
        model,
        "--effort",
        normalizeClaudeEffort(input.thinkingLevel),
        "--tools",
        "",
        "--no-session-persistence",
        "--output-format",
        "text",
        prompt,
      ],
      undefined,
      timeoutMs,
      input.onTextChunk,
    );
  }

  if (localCli === "codex") {
    // Codex CLI is most reliable when the final answer is written to a file; it does not stream token-by-token here.
    const dir = mkdtempSync(path.join(tmpdir(), "panely-codex-"));
    const outputFile = path.join(dir, "last-message.txt");
    try {
      await runCommand(
        "codex",
        [
          "exec",
          "--model",
          model,
          "--sandbox",
          "read-only",
          "--cd",
          process.cwd(),
          "--output-last-message",
          outputFile,
          "--",
          prompt,
        ],
        undefined,
        timeoutMs,
      );
      return readFileSync(outputFile, "utf8").trim();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // Gemini CLI receives prompts on stdin so large source packets do not exceed argv limits.
  return runCommand(
    "gemini",
    [
      "--prompt",
      "",
      "--model",
      model,
      "--output-format",
      "text",
      "--approval-mode",
      "plan",
    ],
    prompt,
    timeoutMs,
    input.onTextChunk,
  );
}

export async function generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
  const modelConfig = getProviderModelById(input.modelId);
  const prompt = input.prompt.trim();

  if (!prompt) {
    throw new Error("Prompt is required");
  }

  if (!modelConfig.localCli) {
    throw new Error(`Model ${modelConfig.name} is not configured for a local CLI source.`);
  }

  const text = await generateWithLocalCli(input, modelConfig.localCli, modelConfig.model);
  if (!text.trim()) {
    throw new Error("empty-output: Provider returned empty output.");
  }

  return {
    text,
    provider: modelConfig.provider,
    modelId: modelConfig.id,
    model: `${modelConfig.localCli}:${modelConfig.model}`,
  };
}
