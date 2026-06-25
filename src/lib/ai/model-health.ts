import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { getProviderModelById, PROVIDERS, type ProviderModel } from "@/lib/ai/providers";
import { classifyProviderError, sanitizeProviderOutput, type ProviderErrorKind } from "@/lib/ai/provider-errors";
import { isVersionOutdated } from "@/lib/ai/cli-version";

const MODEL_PROBE_PROMPT = "Reply with exactly: ok";
const LARGE_CONTEXT_PROBE_PROMPT = `${"Panely local context probe. ".repeat(12000)}\n\nReply with exactly: ok`;
const DAILY_HEALTH_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_FILE = path.join(process.cwd(), "data", "advisory", "model-health-cache.json");

const CLI_PACKAGE_INFO = {
  claude: {
    packageName: "@anthropic-ai/claude-code",
    updateCommand: "npm install -g @anthropic-ai/claude-code@latest",
  },
  codex: {
    packageName: "@openai/codex",
    updateCommand: "npm install -g @openai/codex@latest",
  },
  gemini: {
    packageName: "@google/gemini-cli",
    updateCommand: "npm install -g @google/gemini-cli@latest",
  },
} as const;

export type LocalCliName = keyof typeof CLI_PACKAGE_INFO;
export type ModelHealthStatus = "responding" | "failed" | "missing-cli" | "not-configured";
export type CliUpdateStatus = "current" | "outdated" | "unknown" | "missing";

export interface LocalCliToolStatus {
  available: boolean;
  path?: string;
  version?: string;
  latestVersion?: string;
  packageName?: string;
  installMethod?: "homebrew" | "npm";
  updateCommand?: string;
  updateStatus: CliUpdateStatus;
  isOutdated?: boolean;
  checkedAt: string;
  nextCheckAt: string;
  error?: string;
}

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
  nextCheckAt: string;
  cached?: boolean;
  error?: string;
  errorKind?: ProviderErrorKind;
}

interface HealthCacheStore {
  tools?: Partial<Record<LocalCliName, LocalCliToolStatus>>;
  models?: Record<string, ModelHealthResult>;
}

const healthCache = new Map<string, { expiresAt: number; result: ModelHealthResult }>();
let loadedCache = false;

function nextCheckAt(checkedAt: string) {
  return new Date(new Date(checkedAt).getTime() + DAILY_HEALTH_TTL_MS).toISOString();
}

function isFresh(checkedAt?: string) {
  if (!checkedAt) return false;
  const timestamp = new Date(checkedAt).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp < DAILY_HEALTH_TTL_MS;
}

function readCache(): HealthCacheStore {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")) as HealthCacheStore;
  } catch {
    return {};
  }
}

function writeCache(store: HealthCacheStore) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(store, null, 2));
}

function updateCache(mutator: (store: HealthCacheStore) => void) {
  const store = readCache();
  mutator(store);
  writeCache(store);
}

function hydrateModelCache() {
  if (loadedCache) return;
  loadedCache = true;
  const store = readCache();
  for (const [cacheKey, result] of Object.entries(store.models || {})) {
    if (isFresh(result.checkedAt)) {
      healthCache.set(cacheKey, {
        expiresAt: new Date(result.nextCheckAt).getTime(),
        result: { ...result, cached: true },
      });
    }
  }
}

function getLatestPackageVersion(packageName: string) {
  const latest = spawnSync("npm", ["view", packageName, "version", "--silent"], {
    encoding: "utf8",
    timeout: 5000,
  });
  if (latest.status !== 0) {
    const error = sanitizeProviderOutput(`${latest.stderr || ""}\n${latest.stdout || ""}`.trim());
    return { latestVersion: undefined, error: error || `npm view ${packageName} failed` };
  }
  return { latestVersion: latest.stdout.trim() || undefined, error: undefined };
}

function resolveInstallMethod(command: LocalCliName, cliPath?: string): Pick<LocalCliToolStatus, "installMethod" | "updateCommand"> {
  const packageInfo = CLI_PACKAGE_INFO[command];
  const realPath = cliPath
    ? (() => {
        try {
          return fs.realpathSync(cliPath);
        } catch {
          return cliPath;
        }
      })()
    : "";

  if (realPath.includes("/Cellar/") || realPath.includes("/homebrew/Cellar/")) {
    const formula = command === "gemini" ? "gemini-cli" : command;
    return {
      installMethod: "homebrew",
      updateCommand: `brew upgrade ${formula}`,
    };
  }

  return {
    installMethod: "npm",
    updateCommand: packageInfo.updateCommand,
  };
}

function buildToolStatus(command: LocalCliName, options: { force?: boolean } = {}): LocalCliToolStatus {
  const packageInfo = CLI_PACKAGE_INFO[command];
  const cached = readCache().tools?.[command];
  if (!options.force && cached && isFresh(cached.checkedAt)) return cached;

  const now = new Date().toISOString();
  const located = spawnSync("which", [command], {
    encoding: "utf8",
    timeout: 1000,
  });

  if (located.status !== 0) {
    return {
      available: false,
      packageName: packageInfo.packageName,
      updateCommand: packageInfo.updateCommand,
      installMethod: "npm",
      updateStatus: "missing",
      checkedAt: now,
      nextCheckAt: nextCheckAt(now),
    };
  }

  const version = spawnSync(command, ["--version"], {
    encoding: "utf8",
    timeout: 2000,
  });
  const installedVersion = version.status === 0 ? version.stdout.trim() || version.stderr.trim() : undefined;
  const latest = getLatestPackageVersion(packageInfo.packageName);
  const isOutdated = latest.latestVersion ? isVersionOutdated(installedVersion, latest.latestVersion) : undefined;
  const cliPath = located.stdout.trim();
  const install = resolveInstallMethod(command, cliPath);

  return {
    available: true,
    path: cliPath,
    version: installedVersion,
    latestVersion: latest.latestVersion,
    packageName: packageInfo.packageName,
    installMethod: install.installMethod,
    updateCommand: install.updateCommand,
    updateStatus: isOutdated === true ? "outdated" : isOutdated === false ? "current" : "unknown",
    isOutdated,
    checkedAt: now,
    nextCheckAt: nextCheckAt(now),
    error: latest.error,
  };
}

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

function detectCli(command: LocalCliName, options: { force?: boolean } = {}) {
  const status = buildToolStatus(command, options);
  updateCache((store) => {
    store.tools = { ...(store.tools || {}), [command]: status };
  });
  return status;
}

export function detectLocalCliTools(options: { force?: boolean } = {}) {
  return {
    claude: detectCli("claude", options),
    codex: detectCli("codex", options),
    gemini: detectCli("gemini", options),
  };
}

function makeBaseResult(model: ProviderModel, startedAt: number): Omit<ModelHealthResult, "status" | "ok"> {
  const checkedAt = new Date().toISOString();
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    model: model.model,
    localCli: model.localCli,
    durationMs: Date.now() - startedAt,
    checkedAt,
    nextCheckAt: nextCheckAt(checkedAt),
  };
}

function cacheModelResult(cacheKey: string, result: ModelHealthResult) {
  healthCache.set(cacheKey, { expiresAt: new Date(result.nextCheckAt).getTime(), result });
  updateCache((store) => {
    store.models = { ...(store.models || {}), [cacheKey]: result };
  });
}

export function probeModelHealth(modelId: string, options: { force?: boolean; timeoutMs?: number; largeContext?: boolean } = {}): ModelHealthResult {
  hydrateModelCache();

  const model = getProviderModelById(modelId);
  const cacheKey = `${model.id}:${model.model}:${options.largeContext ? "large" : "tiny"}`;
  const cached = healthCache.get(cacheKey);
  if (!options.force && cached && cached.expiresAt > Date.now()) return { ...cached.result, cached: true };

  const startedAt = Date.now();
  const base = makeBaseResult(model, startedAt);

  if (!model.localCli) {
    const result = { ...base, status: "not-configured" as const, ok: false };
    cacheModelResult(cacheKey, result);
    return result;
  }

  const command = buildProbeCommand(model, { largeContext: options.largeContext });
  if (!command) {
    const result = { ...base, status: "not-configured" as const, ok: false };
    cacheModelResult(cacheKey, result);
    return result;
  }

  const cli = detectCli(command.command as LocalCliName, { force: options.force });
  if (!cli.available) {
    const result = { ...base, durationMs: Date.now() - startedAt, status: "missing-cli" as const, ok: false };
    cacheModelResult(cacheKey, result);
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
  cacheModelResult(cacheKey, result);
  return result;
}

export function probeAllModelHealth(options: { force?: boolean } = {}) {
  return PROVIDERS.map((model) => probeModelHealth(model.id, options));
}

export function probeSelectedModelHealth(modelIds: string[], options: { force?: boolean } = {}) {
  return Array.from(new Set(modelIds.filter(Boolean))).map((modelId) => probeModelHealth(modelId, options));
}
