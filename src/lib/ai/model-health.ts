import { spawnSync } from "child_process";
import { getProviderModelById, PROVIDERS, type ProviderModel } from "@/lib/ai/providers";
import { classifyProviderError, sanitizeProviderOutput, type ProviderErrorKind } from "@/lib/ai/provider-errors";

const MODEL_PROBE_PROMPT = "Reply with exactly: ok";
const LARGE_CONTEXT_PROBE_PROMPT = `${"Panely local context probe. ".repeat(12000)}\n\nReply with exactly: ok`;
const CACHE_TTL_MS = 5 * 60 * 1000;

export type ModelHealthStatus = "responding" | "failed" | "missing-cli" | "not-configured";

export interface ModelHealthResult {
  id: string;
  name: string;
  provider: ProviderModel["provider"];
  model: string;
  localCli?: ProviderModel["localCli"];
  status: ModelHealthStatus;
  ok: boolean;
  durationMs: number;
  checkedAt: string;
  error?: string;
  errorKind?: ProviderErrorKind;
}

const healthCache = new Map<string, { expiresAt: number; result: ModelHealthResult }>();

export function buildProbeCommand(model: ProviderModel, options: { largeContext?: boolean } = {}) {
  if (!model.localCli) return null;
  const probePrompt = options.largeContext && model.localCli === "gemini" ? LARGE_CONTEXT_PROBE_PROMPT : MODEL_PROBE_PROMPT;

  if (model.localCli === "claude") {
    return {
      command: "claude",
      args: ["-p", "--model", model.model, "--tools", "", "--no-session-persistence", "--output-format", "text", probePrompt],
      input: undefined,
    };
  }

  if (model.localCli === "codex") {
    return {
      command: "codex",
      args: ["exec", "--model", model.model, "--sandbox", "read-only", "--", probePrompt],
      input: undefined,
    };
  }

  return {
    command: "gemini",
    args: ["--prompt", "", "--model", model.model, "--output-format", "text", "--approval-mode", "plan"],
    input: probePrompt,
  };
}

function detectCli(command: string) {
  const located = spawnSync("which", [command], {
    encoding: "utf8",
    timeout: 1000,
  });

  if (located.status !== 0) return { available: false };

  const version = spawnSync(command, ["--version"], {
    encoding: "utf8",
    timeout: 2000,
  });

  return {
    available: true,
    path: located.stdout.trim(),
    version: version.status === 0 ? version.stdout.trim() || version.stderr.trim() : undefined,
  };
}

export function detectLocalCliTools() {
  return {
    claude: detectCli("claude"),
    codex: detectCli("codex"),
    gemini: detectCli("gemini"),
  };
}

function makeBaseResult(model: ProviderModel, startedAt: number): Omit<ModelHealthResult, "status" | "ok"> {
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    model: model.model,
    localCli: model.localCli,
    durationMs: Date.now() - startedAt,
    checkedAt: new Date().toISOString(),
  };
}

export function probeModelHealth(modelId: string, options: { force?: boolean; timeoutMs?: number; largeContext?: boolean } = {}): ModelHealthResult {
  const model = getProviderModelById(modelId);
  const cacheKey = `${model.id}:${model.model}:${options.largeContext ? "large" : "tiny"}`;
  const cached = healthCache.get(cacheKey);
  if (!options.force && cached && cached.expiresAt > Date.now()) return cached.result;

  const startedAt = Date.now();
  const base = makeBaseResult(model, startedAt);

  if (!model.localCli) {
    const result = { ...base, status: "not-configured" as const, ok: false };
    healthCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
    return result;
  }

  const command = buildProbeCommand(model, { largeContext: options.largeContext });
  if (!command) {
    const result = { ...base, status: "not-configured" as const, ok: false };
    healthCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
    return result;
  }

  const cli = detectCli(command.command);
  if (!cli.available) {
    const result = { ...base, durationMs: Date.now() - startedAt, status: "missing-cli" as const, ok: false };
    healthCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
    return result;
  }

  const probe = spawnSync(command.command, command.args, {
    input: command.input,
    encoding: "utf8",
    timeout: options.timeoutMs ?? (options.largeContext ? 60000 : 30000),
    maxBuffer: 1024 * 1024,
  });
  const output = sanitizeProviderOutput(`${probe.stdout || ""}\n${probe.stderr || ""}`);
  const ok = probe.status === 0 && /\bok\b/i.test(output);
  const classified = ok ? null : classifyProviderError(output || `${command.command} exited with code ${probe.status ?? "unknown"}`);
  const result: ModelHealthResult = {
    ...base,
    durationMs: Date.now() - startedAt,
    status: ok ? "responding" : "failed",
    ok,
    ...(classified ? { error: classified.message, errorKind: classified.kind } : {}),
  };
  healthCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
  return result;
}

export function probeAllModelHealth(options: { force?: boolean } = {}) {
  return PROVIDERS.map((model) => probeModelHealth(model.id, options));
}

export function probeSelectedModelHealth(modelIds: string[], options: { force?: boolean } = {}) {
  return Array.from(new Set(modelIds.filter(Boolean))).map((modelId) => probeModelHealth(modelId, options));
}
