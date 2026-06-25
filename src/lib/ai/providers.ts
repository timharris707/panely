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
  contextWindow?: number;
  thinkingLevels?: Array<"minimal" | "low" | "medium" | "high" | "xhigh" | "max">;
  intendedUse?: string;
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
    contextWindow: 200000,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    intendedUse: "Deep strategy, synthesis, judgment, and high-stakes critique.",
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
    contextWindow: 200000,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    intendedUse: "Balanced analysis, critique, and live moderation.",
  },
  {
    id: "gemini-pro",
    name: "Gemini 3.1 Pro Preview",
    provider: "google",
    model: "gemini-3.1-pro-preview",
    costTier: "medium",
    routedModel: "google/gemini-3.1-pro-preview",
    localCli: "gemini",
    intent: "Google flagship for long-context analysis, forecasting, and data-heavy review.",
    contextWindow: 1000000,
    thinkingLevels: ["minimal", "low", "medium", "high"],
    intendedUse: "Large source packets, repository review, and long-context comparison.",
  },
  {
    id: "gemini-flash",
    name: "Gemini 3.5 Flash",
    provider: "google",
    model: "gemini-3.5-flash",
    costTier: "medium",
    routedModel: "google/gemini-3.5-flash",
    localCli: "gemini",
    intent: "Google's current Flash frontier model for agentic and coding work.",
    contextWindow: 1000000,
    thinkingLevels: ["minimal", "low", "medium", "high"],
    intendedUse: "Large-context coding, agentic loops, repository review, and fast high-quality comparison passes.",
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
    contextWindow: 200000,
    thinkingLevels: ["minimal", "low", "medium", "high", "xhigh", "max"],
    intendedUse: "Software review, product architecture, implementation planning, and broad reasoning.",
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
