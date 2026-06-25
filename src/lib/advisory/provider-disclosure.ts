import { getProviderModelById } from "../ai/providers.ts";

export type SourceSensitivity = "public" | "unknown" | "non-public";

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

export function inferSourceSensitivity(input: { topic: string; attachedFileCount?: number }): SourceSensitivity {
  if ((input.attachedFileCount ?? 0) > 0) return "unknown";
  const topic = input.topic.trim();
  if (!topic) return "unknown";
  const publicOnly = /^[^\s]+$/i.test(topic) && isKnownPublicUrl(topic);
  return publicOnly ? "public" : "unknown";
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
  modelIds: string[];
  planningModelIds?: string[];
}): ProviderDisclosure {
  const sensitivity = inferSourceSensitivity(input);
  const providers = providerLabelsForModelIds([...(input.planningModelIds ?? []), ...input.modelIds]);
  const requiresConsent = sensitivity !== "public";
  const providerList = providers.length ? providers.join(", ") : "the selected model providers";
  return {
    sensitivity,
    requiresConsent,
    providers,
    message: requiresConsent
      ? `This topic or source material may be non-public. Panely will send it through local CLIs to ${providerList}.`
      : `This appears to be public source material. Panely will use ${providerList}.`,
  };
}
