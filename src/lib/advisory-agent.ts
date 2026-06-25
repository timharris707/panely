import { generateText } from "@/lib/ai/router";

export interface SpawnAdvisoryAgentOptions {
  sessionId: string;
  agentId: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutSeconds?: number;
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
  model?: string;
  onTextChunk?: (chunk: string) => void;
}

export interface SpawnAdvisoryAgentResult {
  text: string;
  model: string;
  durationMs: number;
  runId: string;
}

function buildPrompt(agentId: string, userPrompt: string) {
  return `${userPrompt}

Respond as ${agentId} only. Stay in character, be direct, and avoid generic filler.`;
}

export async function spawnAdvisoryAgent(
  options: SpawnAdvisoryAgentOptions
): Promise<SpawnAdvisoryAgentResult> {
  const start = Date.now();
  const output = await generateText({
    prompt: buildPrompt(options.agentId, options.userPrompt),
    systemPrompt: options.systemPrompt,
    modelId: options.model,
    maxTokens: options.thinkingLevel && options.thinkingLevel !== "off" ? 4096 : 2048,
    temperature: 0.7,
    thinkingLevel: options.thinkingLevel,
    timeoutMs: options.timeoutSeconds ? options.timeoutSeconds * 1000 : undefined,
    onTextChunk: options.onTextChunk,
  });

  return {
    text: output.text,
    model: output.model,
    durationMs: Date.now() - start,
    runId: `advisory-${options.sessionId}-${options.agentId}-${Date.now().toString(36)}`,
  };
}

export async function spawnAdvisoryAgentWithRetry(
  options: SpawnAdvisoryAgentOptions,
  maxRetries = 2
): Promise<SpawnAdvisoryAgentResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await spawnAdvisoryAgent(options);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.warn(
          `[Advisory] Model call failed for ${options.agentId}, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})...`,
          lastError.message
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
}
