import { spawn } from "child_process";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { getProviderModelById, type AIProvider } from "./providers.ts";
import { classifyProviderError } from "./provider-errors.ts";
import { codexReasoningEffortArgs, resolveThinkingLevel, type ThinkingLevel } from "./thinking-levels.ts";

export interface GenerateTextInput {
  prompt: string;
  modelId?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  thinkingLevel?: ThinkingLevel;
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

export interface LocalCliCommand {
  command: "claude" | "codex" | "gemini";
  args: string[];
  input?: string;
  outputFile?: string;
}

export function buildLocalCliCommand(
  input: GenerateTextInput,
  localCli: "claude" | "codex" | "gemini",
  model: string,
  options: { outputFile?: string } = {}
): LocalCliCommand {
  const prompt = composePrompt(input.prompt, input.systemPrompt);

  if (localCli === "claude") {
    const modelConfig = getProviderModelById(input.modelId);
    const effort = resolveThinkingLevel(modelConfig, input.thinkingLevel).effective ?? "low";
    return {
      command: "claude",
      args: [
        "-p",
        "--model",
        model,
        "--effort",
        effort,
        "--tools",
        "",
        "--no-session-persistence",
        "--output-format",
        "text",
        prompt,
      ],
    };
  }

  if (localCli === "codex") {
    const modelConfig = getProviderModelById(input.modelId);
    const reasoningArgs = codexReasoningEffortArgs(resolveThinkingLevel(modelConfig, input.thinkingLevel));
    const outputFile = options.outputFile;
    if (!outputFile) {
      throw new Error("Codex CLI command construction requires an output file.");
    }
    return {
      command: "codex",
      args: [
        "exec",
        "--model",
        model,
        ...reasoningArgs,
        "--sandbox",
        "read-only",
        "--cd",
        process.cwd(),
        "--output-last-message",
        outputFile,
        "--",
        prompt,
      ],
      outputFile,
    };
  }

  return {
    command: "gemini",
    args: [
      "--prompt",
      "",
      "--model",
      model,
      "--output-format",
      "text",
      "--approval-mode",
      "plan",
    ],
    input: prompt,
  };
}

async function generateWithLocalCli(input: GenerateTextInput, localCli: "claude" | "codex" | "gemini", model: string): Promise<string> {
  const derivedTimeoutMs = Math.max(120000, Math.min(300000, (input.maxTokens ?? 2048) * 60));
  const timeoutMs = input.timeoutMs
    ? Math.max(30000, Math.min(300000, input.timeoutMs))
    : derivedTimeoutMs;

  if (localCli === "claude") {
    const command = buildLocalCliCommand(input, localCli, model);
    // Claude CLI accepts the prompt as an argv tail and streams stdout directly.
    return runCommand(
      command.command,
      command.args,
      command.input,
      timeoutMs,
      input.onTextChunk,
    );
  }

  if (localCli === "codex") {
    // Codex CLI is most reliable when the final answer is written to a file; it does not stream token-by-token here.
    const dir = mkdtempSync(path.join(tmpdir(), "panely-codex-"));
    const outputFile = path.join(dir, "last-message.txt");
    try {
      const command = buildLocalCliCommand(input, localCli, model, { outputFile });
      await runCommand(
        command.command,
        command.args,
        command.input,
        timeoutMs,
      );
      return readFileSync(outputFile, "utf8").trim();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // Gemini CLI receives prompts on stdin so large source packets do not exceed argv limits.
  const command = buildLocalCliCommand(input, localCli, model);
  return runCommand(
    command.command,
    command.args,
    command.input,
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
