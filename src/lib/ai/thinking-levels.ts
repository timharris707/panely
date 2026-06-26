import type { ProviderModel } from "@/lib/ai/providers";
import { fallbackCliThinkingCapability, normalizeCliThinkingLevel, type CliThinkingCapability, type CliThinkingLevel } from "./cli-capabilities.ts";

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

type ThinkingCapabilityInput = Partial<Pick<CliThinkingCapability, "supportedThinkingLevels" | "thinkingEnforced" | "thinkingNote">> & {
  providerThinkingLevels?: Array<Exclude<ThinkingLevel, "off">>;
};

export interface ThinkingLevelResolution {
  requested: ThinkingLevel;
  effective?: Exclude<ThinkingLevel, "off">;
  enforced: boolean;
  normalized: boolean;
  note: string;
}

export function supportedThinkingLevels(
  model: ProviderModel,
  capability?: ThinkingCapabilityInput
): ThinkingLevel[] {
  const providerLevels = capability?.providerThinkingLevels ?? model.thinkingLevels ?? [];
  const clampToProvider = (levels: ThinkingLevel[]) => (
    providerLevels.length ? levels.filter((level) => providerLevels.includes(level as Exclude<ThinkingLevel, "off">)) : levels
  );

  if (capability?.thinkingEnforced && capability.supportedThinkingLevels) {
    return clampToProvider(capability.supportedThinkingLevels);
  }
  if (capability && !capability.thinkingEnforced) return [];
  if (model.localCli === "claude") return clampToProvider(fallbackCliThinkingCapability("claude").supportedThinkingLevels);
  if (model.localCli === "codex") return clampToProvider(fallbackCliThinkingCapability("codex").supportedThinkingLevels);
  if (model.localCli === "gemini") return [];
  return providerLevels;
}

export function resolveThinkingLevel(
  model: ProviderModel,
  requestedLevel?: ThinkingLevel,
  capability?: ThinkingCapabilityInput
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
    const supported = supportedThinkingLevels(model, activeCapability);
    const resolved = normalizeCliThinkingLevel(requested, {
      supportedThinkingLevels: supported.filter((level) => level !== "off") as CliThinkingLevel[],
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
