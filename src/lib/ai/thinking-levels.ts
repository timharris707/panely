import type { ProviderModel } from "@/lib/ai/providers";

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface ThinkingLevelResolution {
  requested: ThinkingLevel;
  effective?: Exclude<ThinkingLevel, "off">;
  enforced: boolean;
  normalized: boolean;
  note: string;
}

export function supportedThinkingLevels(model: ProviderModel): ThinkingLevel[] {
  if (model.localCli === "claude") return ["low", "medium", "high", "xhigh", "max"];
  if (model.localCli === "codex") return ["minimal", "low", "medium", "high", "xhigh", "max"];
  if (model.localCli === "gemini") return [];
  return model.thinkingLevels ?? [];
}

export function resolveThinkingLevel(model: ProviderModel, requestedLevel?: ThinkingLevel): ThinkingLevelResolution {
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

  if (model.localCli === "gemini") {
    return {
      requested,
      effective: undefined,
      enforced: false,
      normalized: false,
      note: "Gemini CLI thinking level is not enforced because the installed CLI does not expose a stable thinking flag.",
    };
  }

  const supported = supportedThinkingLevels(model);
  if (supported.includes(requested)) {
    return {
      requested,
      effective: requested === "minimal" && model.localCli === "claude" ? "low" : requested,
      enforced: true,
      normalized: requested === "minimal" && model.localCli === "claude",
      note: requested === "minimal" && model.localCli === "claude"
        ? "Claude CLI does not expose minimal effort; using low."
        : "Thinking level is passed to the local CLI.",
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
