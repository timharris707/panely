import { getProviderModelById } from "../ai/providers.ts";

export type SourceSensitivity = "public" | "unknown" | "non-public";
export type SourceKind = "attached-file" | "local-project";

export interface ProviderDisclosure {
  sensitivity: SourceSensitivity;
  requiresConsent: boolean;
  providers: string[];
  message: string;
}

const PROVIDER_LABELS = {
  anthropic: "Anthropic / Claude",
  openai: "OpenAI / Codex",
  google: "Google / Gemini",
} as const;

const PUBLIC_URL_HOSTS = new Set([
  "github.com",
  "gist.github.com",
  "npmjs.com",
  "www.npmjs.com",
  "developer.mozilla.org",
  "nextjs.org",
  "react.dev",
]);

function isKnownPublicUrl(value: string) {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return PUBLIC_URL_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

const BENIGN_PUBLIC_URL_TOPIC_TOKENS = new Set([
  "a",
  "about",
  "against",
  "an",
  "analyze",
  "and",
  "at",
  "can",
  "check",
  "compare",
  "docs",
  "documentation",
  "evaluate",
  "for",
  "from",
  "github",
  "it",
  "link",
  "look",
  "of",
  "on",
  "page",
  "please",
  "project",
  "public",
  "read",
  "repo",
  "repository",
  "review",
  "source",
  "summarize",
  "the",
  "this",
  "url",
  "use",
  "with",
  "you",
]);

function hasOnlyBenignPublicUrlContext(topic: string, urls: string[]) {
  const remainder = urls
    .reduce((text, url) => text.replace(url, " "), topic)
    .replace(/[`"'()[\]{}:;,.!?/#_-]+/g, " ")
    .trim()
    .toLowerCase();
  if (!remainder) return true;
  const tokens = remainder.split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => BENIGN_PUBLIC_URL_TOPIC_TOKENS.has(token));
}

export function inferSourceSensitivity(input: {
  topic: string;
  attachedFileCount?: number;
  localProjectFileCount?: number;
}): SourceSensitivity {
  if ((input.localProjectFileCount ?? 0) > 0) {
    return "non-public";
  }
  if ((input.attachedFileCount ?? 0) > 0) return "unknown";
  const topic = input.topic.trim();
  if (!topic) return "unknown";
  const publicOnly = /^[^\s]+$/i.test(topic) && isKnownPublicUrl(topic);
  if (publicOnly) return "public";

  const urls = Array.from(topic.matchAll(/https?:\/\/[^\s)\]]+/gi)).map((match) => match[0]);
  const hasPrivateHints = /\b(private|confidential|non-public|internal|attached file|\/Users\/|file:\/\/)/i.test(topic);
  if (urls.length > 0 && !hasPrivateHints && urls.every(isKnownPublicUrl) && hasOnlyBenignPublicUrlContext(topic, urls)) {
    return "public";
  }

  return "unknown";
}

export function providerLabelsForModelIds(modelIds: string[]) {
  return Array.from(new Set(
    modelIds
      .map((modelId) => PROVIDER_LABELS[getProviderModelById(modelId).provider])
      .filter(Boolean)
  ));
}

export function buildProviderDisclosure(input: {
  topic: string;
  attachedFileCount?: number;
  localProjectFileCount?: number;
  sourceKinds?: SourceKind[];
  modelIds: string[];
  planningModelIds?: string[];
}): ProviderDisclosure {
  const hasLocalProject = (input.localProjectFileCount ?? 0) > 0 || input.sourceKinds?.includes("local-project") === true;
  const sensitivity = hasLocalProject ? "non-public" : inferSourceSensitivity(input);
  const providers = providerLabelsForModelIds([...(input.planningModelIds ?? []), ...input.modelIds]);
  const requiresConsent = sensitivity !== "public";
  const providerList = providers.length ? providers.join(", ") : "the selected model providers";
  return {
    sensitivity,
    requiresConsent,
    providers,
    message: requiresConsent
      ? hasLocalProject
        ? `This local project source is non-public. Panely will send the selected project packet through local CLIs to ${providerList}.`
        : `This topic or source material may be non-public. Panely will send it through local CLIs to ${providerList}.`
      : `This appears to be public source material. Panely will use ${providerList}.`,
  };
}
