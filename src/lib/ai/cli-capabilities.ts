export type CliThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export type CliCapabilityCommand = "claude" | "codex" | "gemini" | "agy";

export interface CliThinkingCapability {
  schemaVersion: 1;
  supportedThinkingLevels: CliThinkingLevel[];
  thinkingEnforced: boolean;
  thinkingEvidence: string;
  thinkingNote: string;
  contextWindow?: number;
  contextEvidence?: string;
  contextNote?: string;
  capabilityCheckedAt: string;
}

export const CLI_CAPABILITY_SCHEMA_VERSION = 1;

const THINKING_ORDER: CliThinkingLevel[] = ["minimal", "low", "medium", "high", "xhigh", "max"];

function nowIso() {
  return new Date().toISOString();
}

function uniqueInThinkingOrder(values: string[]) {
  const found = new Set(values.map((value) => value.toLowerCase()));
  return THINKING_ORDER.filter((level) => found.has(level));
}

export function parseSupportedEffortLevels(text: string): CliThinkingLevel[] {
  const source = text.toLowerCase();
  if (!source.trim()) return [];

  const snippets: string[] = [];
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (/\b(?:--effort|effort|reasoning)\b/.test(lines[index])) {
      snippets.push([lines[index], lines[index + 1] || ""].join(" "));
    }
  }

  const oneOfMatches = source.matchAll(/(?:one of|must be one of|values? are|supported values?[:\s]+)\s*([a-z0-9_,\s|-]+)/g);
  for (const match of oneOfMatches) {
    snippets.push(match[1]);
  }

  const levelPattern = /\b(minimal|low|medium|high|xhigh|max)\b/g;
  for (const snippet of snippets) {
    const levels = uniqueInThinkingOrder(Array.from(snippet.matchAll(levelPattern), (match) => match[1]));
    if (levels.length >= 2) return levels;
  }

  return [];
}

export function fallbackCliThinkingCapability(command: CliCapabilityCommand, checkedAt = nowIso()): CliThinkingCapability {
  if (command === "claude") {
    return {
      schemaVersion: CLI_CAPABILITY_SCHEMA_VERSION,
      supportedThinkingLevels: ["low", "medium", "high", "max"],
      thinkingEnforced: true,
      thinkingEvidence: "fallback: Claude Code has historically exposed --effort low, medium, high, max.",
      thinkingNote: "Claude effort levels are using fallback capability data until the local CLI help can be checked.",
      contextWindow: 200000,
      contextEvidence: "fallback: configured Claude context estimate.",
      contextNote: "Context window is a fallback estimate because Claude CLI did not expose a parseable context limit.",
      capabilityCheckedAt: checkedAt,
    };
  }

  if (command === "codex") {
    return {
      schemaVersion: CLI_CAPABILITY_SCHEMA_VERSION,
      supportedThinkingLevels: ["minimal", "low", "medium", "high", "xhigh", "max"],
      thinkingEnforced: true,
      thinkingEvidence: "fallback: Codex reasoning effort is passed with model_reasoning_effort.",
      thinkingNote: "Codex reasoning effort is passed to the local CLI; run a force check if this CLI changes.",
      contextWindow: 1000000,
      contextEvidence: "fallback: configured Codex frontier context estimate.",
      contextNote: "Context window is a fallback estimate; Panely uses the highest configured Codex context budget unless the CLI reports otherwise.",
      capabilityCheckedAt: checkedAt,
    };
  }

  if (command === "gemini") {
    return {
      schemaVersion: CLI_CAPABILITY_SCHEMA_VERSION,
      supportedThinkingLevels: [],
      thinkingEnforced: false,
      thinkingEvidence: "not-enforceable: Gemini CLI did not expose a stable thinking flag in Panely's current adapter.",
      thinkingNote: "Gemini thinking level is not enforced because Panely has not verified a stable local CLI thinking flag.",
      contextWindow: 1000000,
      contextEvidence: "fallback: configured Gemini long-context estimate.",
      contextNote: "Context window is a fallback estimate because Gemini CLI did not expose a parseable context limit.",
      capabilityCheckedAt: checkedAt,
    };
  }

  return {
    schemaVersion: CLI_CAPABILITY_SCHEMA_VERSION,
    supportedThinkingLevels: [],
    thinkingEnforced: false,
    thinkingEvidence: "not-enforceable: Antigravity is tracked as a fallback tool, not a Panely model route.",
    thinkingNote: "Antigravity is available as a Gemini fallback, but Panely does not expose enforceable thinking levels for it yet.",
    contextWindow: 1000000,
    contextEvidence: "fallback: Antigravity is treated as a Gemini-family fallback.",
    contextNote: "Context window is a fallback estimate.",
    capabilityCheckedAt: checkedAt,
  };
}

export function deriveCliThinkingCapability(input: {
  command: CliCapabilityCommand;
  helpText?: string;
  errorText?: string;
  checkedAt?: string;
}): CliThinkingCapability {
  const checkedAt = input.checkedAt || nowIso();

  if (input.command === "claude") {
    const parsed = parseSupportedEffortLevels(`${input.helpText || ""}\n${input.errorText || ""}`);
    if (parsed.length) {
      return {
        schemaVersion: CLI_CAPABILITY_SCHEMA_VERSION,
        supportedThinkingLevels: parsed,
        thinkingEnforced: true,
        thinkingEvidence: `verified: claude --help exposed ${parsed.join(", ")}`,
        thinkingNote: "Claude effort levels were read from the installed CLI.",
        contextWindow: fallbackCliThinkingCapability("claude", checkedAt).contextWindow,
        contextEvidence: "fallback: Claude CLI help did not expose a parseable context limit.",
        contextNote: "Context window is a fallback estimate even though effort levels were verified.",
        capabilityCheckedAt: checkedAt,
      };
    }
  }

  return fallbackCliThinkingCapability(input.command, checkedAt);
}

export function normalizeCliThinkingLevel(
  requested: CliThinkingLevel,
  capability: Pick<CliThinkingCapability, "supportedThinkingLevels" | "thinkingEnforced" | "thinkingNote">
) {
  if (!capability.thinkingEnforced || !capability.supportedThinkingLevels.length) {
    return {
      effective: undefined,
      normalized: false,
      enforced: false,
      note: capability.thinkingNote || "No enforceable thinking level is available for this CLI.",
    };
  }

  if (capability.supportedThinkingLevels.includes(requested)) {
    return {
      effective: requested,
      normalized: false,
      enforced: true,
      note: "Thinking level is passed to the local CLI.",
    };
  }

  const fallback = capability.supportedThinkingLevels.at(-1);
  return {
    effective: fallback,
    normalized: Boolean(fallback),
    enforced: Boolean(fallback),
    note: fallback
      ? `Requested thinking level is not supported by the current CLI; using ${fallback}.`
      : "No enforceable thinking level is available for this CLI.",
  };
}
