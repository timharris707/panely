import fs from "fs";
import path from "path";
import { PROVIDERS, type AIProvider, type ProviderModel } from "./providers.ts";

export type ProviderThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface ProviderCapabilityEntry {
  modelId: string;
  provider: AIProvider;
  model: string;
  thinkingLevels: ProviderThinkingLevel[];
  sourceUrl: string;
  sourceName: string;
  fetchedAt: string;
  evidence: string;
}

export interface ProviderCapabilityCache {
  schemaVersion: typeof PROVIDER_CAPABILITY_CACHE_SCHEMA_VERSION;
  refreshedAt: string;
  entries: Record<string, ProviderCapabilityEntry>;
  errors?: string[];
}

type ProviderCapabilitySource = {
  provider: AIProvider;
  name: string;
  url: string;
};

export const PROVIDER_CAPABILITY_CACHE_SCHEMA_VERSION = 1;
export const PROVIDER_CAPABILITY_CACHE_FILE = path.join(process.cwd(), "data", "advisory", "provider-capability-cache.json");

export const PROVIDER_CAPABILITY_SOURCES: Record<AIProvider, ProviderCapabilitySource> = {
  openai: {
    provider: "openai",
    name: "OpenAI GPT-5.5 guide",
    url: "https://developers.openai.com/api/docs/guides/latest-model",
  },
  google: {
    provider: "google",
    name: "Google Gemini thinking guide",
    url: "https://ai.google.dev/gemini-api/docs/generate-content/thinking",
  },
  anthropic: {
    provider: "anthropic",
    name: "Claude Code CLI reference",
    url: "https://docs.anthropic.com/en/docs/claude-code/cli-reference",
  },
};

const THINKING_LEVEL_ORDER: ProviderThinkingLevel[] = ["minimal", "low", "medium", "high", "xhigh", "max"];

function isProviderThinkingLevel(value: string): value is ProviderThinkingLevel {
  return THINKING_LEVEL_ORDER.includes(value as ProviderThinkingLevel);
}

function normalizeLevels(levels: string[]) {
  const found = new Set(levels.map((level) => level.toLowerCase()).filter(isProviderThinkingLevel));
  return THINKING_LEVEL_ORDER.filter((level) => found.has(level));
}

function cacheIsValid(cache: ProviderCapabilityCache | null): cache is ProviderCapabilityCache {
  return Boolean(cache && cache.schemaVersion === PROVIDER_CAPABILITY_CACHE_SCHEMA_VERSION && cache.entries);
}

export function readProviderCapabilityCache(): ProviderCapabilityCache | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(PROVIDER_CAPABILITY_CACHE_FILE, "utf8")) as ProviderCapabilityCache;
    return cacheIsValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function providerCapabilityCacheIsFresh(cache: ProviderCapabilityCache | null, maxAgeMs: number) {
  if (!cacheIsValid(cache)) return false;
  const refreshedAt = new Date(cache.refreshedAt).getTime();
  return Number.isFinite(refreshedAt) && Date.now() - refreshedAt < maxAgeMs;
}

export function writeProviderCapabilityCache(cache: ProviderCapabilityCache) {
  fs.mkdirSync(path.dirname(PROVIDER_CAPABILITY_CACHE_FILE), { recursive: true });
  fs.writeFileSync(PROVIDER_CAPABILITY_CACHE_FILE, JSON.stringify(cache, null, 2));
}

export function staticProviderThinkingLevels(model: ProviderModel): ProviderThinkingLevel[] {
  return normalizeLevels(model.thinkingLevels ?? []);
}

export function providerThinkingLevels(model: ProviderModel, cache = readProviderCapabilityCache()): ProviderThinkingLevel[] {
  const cached = cache?.entries?.[model.id]?.thinkingLevels;
  return cached?.length ? normalizeLevels(cached) : staticProviderThinkingLevels(model);
}

export function providerThinkingSource(model: ProviderModel, cache = readProviderCapabilityCache()) {
  const cached = cache?.entries?.[model.id];
  if (cached) return cached;
  const source = PROVIDER_CAPABILITY_SOURCES[model.provider];
  return {
    modelId: model.id,
    provider: model.provider,
    model: model.model,
    thinkingLevels: staticProviderThinkingLevels(model),
    sourceUrl: source.url,
    sourceName: source.name,
    fetchedAt: "",
    evidence: "Static Panely capability table; run the capability refresh to compare against official docs.",
  } satisfies ProviderCapabilityEntry;
}

function htmlToSearchableText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchOfficialText(source: ProviderCapabilitySource, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(source.url, {
      headers: { "User-Agent": "Panely capability refresh" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${source.name} returned HTTP ${response.status}`);
    return htmlToSearchableText(await response.text());
  } finally {
    clearTimeout(timer);
  }
}

function extractProviderThinkingLevels(provider: AIProvider, text: string): { levels: ProviderThinkingLevel[]; evidence: string } {
  const source = text.toLowerCase();

  if (provider === "openai") {
    if (/reasoning\.effort/.test(source) && /\blow\b/.test(source) && /\bmedium\b/.test(source) && /\bhigh\b/.test(source) && /\bxhigh\b/.test(source)) {
      return {
        levels: ["low", "medium", "high", "xhigh"],
        evidence: "Official OpenAI guide references reasoning.effort with low, medium, high, and xhigh.",
      };
    }
  }

  if (provider === "google") {
    if (/thinkinglevel/.test(source) && /\blow\b/.test(source) && /\bmedium\b/.test(source) && /\bhigh\b/.test(source)) {
      return {
        levels: ["low", "medium", "high"],
        evidence: "Official Gemini thinking guide lists thinkingLevel low, medium, and high for Gemini 3 models.",
      };
    }
  }

  if (provider === "anthropic") {
    if (/\b--effort\b/.test(source) && /\blow\b/.test(source) && /\bmedium\b/.test(source) && /\bhigh\b/.test(source) && /\bxhigh\b/.test(source) && /\bmax\b/.test(source)) {
      return {
        levels: ["low", "medium", "high", "xhigh", "max"],
        evidence: "Official Claude Code CLI reference lists --effort options low, medium, high, xhigh, and max.",
      };
    }
  }

  return {
    levels: [],
    evidence: "Could not parse thinking levels from the official source.",
  };
}

export async function refreshProviderCapabilityCache(options: { timeoutMs?: number } = {}) {
  const timeoutMs = options.timeoutMs ?? 10000;
  const fetchedAt = new Date().toISOString();
  const entries: Record<string, ProviderCapabilityEntry> = {};
  const errors: string[] = [];

  const byProvider = await Promise.all(
    Object.values(PROVIDER_CAPABILITY_SOURCES).map(async (source) => {
      try {
        const text = await fetchOfficialText(source, timeoutMs);
        return { source, parsed: extractProviderThinkingLevels(source.provider, text) };
      } catch (err) {
        errors.push(`${source.name}: ${err instanceof Error ? err.message : String(err)}`);
        return { source, parsed: { levels: [], evidence: "Official source fetch failed; using static Panely capability table." } };
      }
    }),
  );

  const parsedByProvider = new Map(byProvider.map((item) => [item.source.provider, item]));
  for (const model of PROVIDERS) {
    const source = PROVIDER_CAPABILITY_SOURCES[model.provider];
    const parsed = parsedByProvider.get(model.provider)?.parsed;
    const levels = parsed?.levels.length ? parsed.levels : staticProviderThinkingLevels(model);
    entries[model.id] = {
      modelId: model.id,
      provider: model.provider,
      model: model.model,
      thinkingLevels: levels,
      sourceUrl: source.url,
      sourceName: source.name,
      fetchedAt,
      evidence: parsed?.evidence ?? "Static Panely capability table.",
    };
  }

  const cache: ProviderCapabilityCache = {
    schemaVersion: PROVIDER_CAPABILITY_CACHE_SCHEMA_VERSION,
    refreshedAt: fetchedAt,
    entries,
    ...(errors.length ? { errors } : {}),
  };
  writeProviderCapabilityCache(cache);
  return cache;
}
