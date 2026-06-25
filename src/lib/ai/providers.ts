export type AIProvider = "anthropic" | "openai" | "google";

export interface ProviderModel {
  id: string;
  name: string;
  provider: AIProvider;
  model: string;
  costTier: "low" | "medium" | "high";
  default?: boolean;
  routedModel?: string;
  localCli?: "claude" | "codex" | "gemini";
  intent?: string;
}

export const PROVIDERS: ProviderModel[] = [
  {
    id: "claude-opus",
    name: "Claude Code 4.8",
    provider: "anthropic",
    model: "claude-opus-4-8",
    costTier: "high",
    routedModel: "anthropic/claude-opus-4-8",
    localCli: "claude",
    intent: "Most capable Claude option for hard reasoning and agentic work.",
  },
  {
    id: "claude-sonnet",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    costTier: "medium",
    default: true,
    routedModel: "anthropic/claude-sonnet-4-6",
    localCli: "claude",
    intent: "Deep reasoning, synthesis, and careful critique.",
  },
  {
    id: "codex-frontier",
    name: "GPT-5.5",
    provider: "openai",
    model: "gpt-5.5",
    costTier: "high",
    routedModel: "openai/gpt-5.5",
    localCli: "codex",
    intent: "Coding, product strategy, and broad frontier reasoning.",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    model: "gpt-4o",
    costTier: "medium",
    routedModel: "openai/gpt-4o",
    localCli: "codex",
    intent: "Fast general-purpose fallback.",
  },
  {
    id: "gemini-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    model: "gemini-2.5-pro",
    costTier: "medium",
    routedModel: "google/gemini-2.5-pro",
    localCli: "gemini",
    intent: "Long-context analysis, forecasting, and data-heavy review.",
  },
  {
    id: "gemini-flash",
    name: "Gemini Flash",
    provider: "google",
    model: "gemini-2.5-flash",
    costTier: "low",
    routedModel: "google/gemini-2.5-flash",
    localCli: "gemini",
  },
];

export function getDefaultProviderModel(): ProviderModel {
  const fallback = PROVIDERS[0];
  return PROVIDERS.find((m) => m.default) ?? fallback;
}

export function getProviderModelById(modelId?: string): ProviderModel {
  if (!modelId) return getDefaultProviderModel();
  return PROVIDERS.find((m) => m.id === modelId) ?? getDefaultProviderModel();
}

export function resolveProviderModelId(modelId?: string): string {
  return getProviderModelById(modelId).id;
}
