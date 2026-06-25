import type { ProviderModel } from "@/lib/ai/providers";
import { fallbackCliThinkingCapability, normalizeCliThinkingLevel, type CliThinkingCapability } from "./cli-capabilities.ts";

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface ThinkingLevelResolution {
  requested: ThinkingLevel;
  effective?: Exclude<ThinkingLevel, "off">;
  enforced: boolean;
  normalized: boolean;
  note: string;
}

export function supportedThinkingLevels(
  model: ProviderModel,
  capability?: Partial<Pick<CliThinkingCapability, "supportedThinkingLevels" | "thinkingEnforced">>
): ThinkingLevel[] {
  if (capability?.thinkingEnforced && capability.supportedThinkingLevels) return capability.supportedThinkingLevels;
  if (capability && !capability.thinkingEnforced) return [];
  if (model.localCli === "claude") return fallbackCliThinkingCapability("claude").supportedThinkingLevels;
  if (model.localCli === "codex") return fallbackCliThinkingCapability("codex").supportedThinkingLevels;
  if (model.localCli === "gemini") return [];
  return model.thinkingLevels ?? [];
}

export function resolveThinkingLevel(
  model: ProviderModel,
  requestedLevel?: ThinkingLevel,
  capability?: Partial<Pick<CliThinkingCapability, "supportedThinkingLevels" | "thinkingEnforced" | "thinkingNote">>
): ThinkingLevelResolution {
  const requested = requestedLevel ?? "medium";

  if (requested === "off") {
    return {
      requested,
      effective: undefined,
      enforced: false,
      normalized: false,
      note: "Thinking control disabled for this run.",
    };
  }

  const fallbackCapability = model.localCli ? fallbackCliThinkingCapability(model.localCli) : undefined;
  const activeCapability = capability || fallbackCapability;

  if (model.localCli === "gemini" && !activeCapability?.thinkingEnforced) {
    return {
      requested,
      effective: undefined,
      enforced: false,
      normalized: false,
      note: "Gemini CLI thinking level is not enforced because the installed CLI does not expose a stable thinking flag.",
    };
  }

  if (
    activeCapability &&
    typeof activeCapability.thinkingEnforced === "boolean" &&
    Array.isArray(activeCapability.supportedThinkingLevels)
  ) {
    const resolved = normalizeCliThinkingLevel(requested, {
      supportedThinkingLevels: activeCapability.supportedThinkingLevels,
      thinkingEnforced: activeCapability.thinkingEnforced,
      thinkingNote: activeCapability.thinkingNote || "",
    });
    return {
      requested,
      effective: resolved.effective,
      enforced: resolved.enforced,
      normalized: resolved.normalized,
      note: resolved.note,
    };
  }

  const supported = supportedThinkingLevels(model);
  if (supported.includes(requested)) {
    return {
      requested,
      effective: requested,
      enforced: true,
      normalized: false,
      note: "Thinking level is passed to the local CLI.",
    };
  }

  const fallback = supported.at(-1) as Exclude<ThinkingLevel, "off"> | undefined;
  return {
    requested,
    effective: fallback,
    enforced: Boolean(fallback),
    normalized: Boolean(fallback),
    note: fallback
      ? `Requested thinking level is not supported for this model; using ${fallback}.`
      : "No enforceable thinking level is available for this model.",
  };
}

export function codexReasoningEffortArgs(resolution: ThinkingLevelResolution): string[] {
  if (!resolution.enforced || !resolution.effective) return [];
  return ["--config", `model_reasoning_effort=\"${resolution.effective}\"`];
}
