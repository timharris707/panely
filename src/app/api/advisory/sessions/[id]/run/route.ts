import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { sessionFileStore as fs } from "@/lib/advisory-session-store";
import { AGENT_CONFIGS } from "@/config/agents";
import { spawnAdvisoryAgentWithRetry, type SpawnAdvisoryAgentResult } from "@/lib/advisory-agent";
import { resolveProviderModelId } from "@/lib/ai/providers";
import { classifyProviderError } from "@/lib/ai/provider-errors";
import { finishRunAttempt, startRunAttempt, type RunAttemptStartInput } from "@/lib/advisory-run-telemetry";
import {
  buildTopIdeasFromTally,
  filterBlindVoteEvents,
  parseCompetitiveVote,
  parseTopIdeaVotes,
  registerTopIdeaVote,
  selectWinner,
} from "@/lib/advisory/competitive";
import { buildRequestedModelProvenance } from "@/lib/advisory/provenance";
import {
  buildFormalRoundOneSystemPrompt,
  buildFormalRoundOneUserPrompt,
  buildFormalRoundTwoSystemPrompt,
  buildFormalRoundTwoUserPrompt,
  buildFormalSynthesisPrompt,
  buildFormalVerdict,
  canRunFormalBoard,
  createFormalBoardState,
  recordFormalRoundArtifact,
  setFormalBoardPhase,
} from "@/lib/advisory/formal-board";
import { buildSourcePacket } from "@/lib/advisory/source-packet";
import { completeRunStep, createRunStep, failRunStep } from "@/lib/advisory/run-ledger";
import type { AdvisoryRunAttempt, AdvisoryRunStep, FormalBoardState } from "@/types/advisory";

const DATA_DIR = path.join(process.cwd(), "data", "advisory");
const MEMORY_FILE = path.join(DATA_DIR, "agent-memory.json");

function eventProvenance(requestedModel?: string, observedModel?: string) {
  return buildRequestedModelProvenance(requestedModel, observedModel);
}

// ─── Agent memory ─────────────────────────────────────────────────────────────

interface AgentMemoryEntry {
  id: string;
  agent: string;
  topic: string;
  sessionId: string;
  date: string;
  decisions: string[];
  insights: string[];
  actionItems: string[];
}

function getAgentMemory(agentName: string, maxEntries = 5): AgentMemoryEntry[] {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return [];
    const all: AgentMemoryEntry[] = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
    return all
      .filter((e) => e.agent === agentName)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, maxEntries);
  } catch {
    return [];
  }
}

function formatMemoryForPrompt(entries: AgentMemoryEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.map((e) => {
    const date = new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const parts: string[] = [`- **${date} — ${e.topic}**`];
    if (e.decisions.length > 0) parts.push(`  Decisions: ${e.decisions.join("; ")}`);
    if (e.insights.length > 0) parts.push(`  Insights: ${e.insights.join("; ")}`);
    if (e.actionItems.length > 0) parts.push(`  Action items: ${e.actionItems.join("; ")}`);
    return parts.join("\n");
  });
  return `\nYou recall from previous advisory sessions:\n${lines.join("\n")}\n`;
}

// ─── Agent definitions ────────────────────────────────────────────────────────
// Build from the canonical AGENT_CONFIGS so personas are single-sourced

// Canonical name mapping: advisory display names → config IDs
const ADVISORY_NAME_TO_CONFIG_ID: Record<string, string> = {
  Henry: "henry",
  Atlas: "t1",
  Nimbus: "t2",
  Cipher: "t3",
  Quant: "quant",
  Forge: "backend",
  Pixel: "fullstack",
  Scout: "scout",
  Quill: "quill",
  Counsel: "counsel",
};

interface AgentDef {
  name: string;
  emoji: string;
  role: string;
  expertise: string;
  persona: string;
}

interface SessionPersona {
  id?: string;
  name?: string;
  role?: string;
  description?: string;
  modelId?: string;
  thinkingLevel?: string;
}

function buildAgentDefs(): Record<string, AgentDef> {
  const defs: Record<string, AgentDef> = {};
  for (const [advisoryName, configId] of Object.entries(ADVISORY_NAME_TO_CONFIG_ID)) {
    const config = AGENT_CONFIGS.find((a) => a.id === configId);
    if (config) {
      defs[advisoryName] = {
        name: advisoryName,
        emoji: config.emoji,
        role: config.role,
        expertise: config.description,
        persona: config.persona,
      };
    }
  }
  return defs;
}

const AGENT_DEFS: Record<string, AgentDef> = buildAgentDefs();

function getSessionAgentIdentity(session: Record<string, unknown>, agentId: string): AgentDef {
  const staticAgent = AGENT_DEFS[agentId];
  if (staticAgent) return staticAgent;

  const personas = Array.isArray(session.aiPersonas)
    ? (session.aiPersonas as SessionPersona[])
    : [];
  const persona = personas.find((item) => item.name === agentId || item.id === agentId);
  const name = persona?.name || agentId;
  const role = persona?.role || "temporary advisor";
  const expertise = persona?.description || `A purpose-built Panely advisor for ${role}.`;

  return {
    name,
    emoji: "💬",
    role,
    expertise,
    persona: `You are ${name}, a temporary AI advisor created specifically for this Panely session.

Your role is: ${role}.
Your assignment is: ${expertise}

You do not represent a legacy named agent or fixed department. You exist only for this session, and your value comes from applying this specific lens with clarity, independence, and rigor.`,
  };
}

// ─── Persona overlay content ──────────────────────────────────────────────────

const PERSONA_CONTENT: Record<string, string> = {
  "trading-strategist":
    "Apply deep quantitative analysis to this discussion: consider momentum signals, mean-reversion opportunities, risk-reward optimization, and position sizing.",
  "seo-specialist":
    "Bring an SEO lens: keyword research insights, SERP competition, content gap analysis, on-page optimization opportunities, and organic growth potential.",
  "growth-hacker":
    "Think like a growth hacker: identify viral loops, acquisition funnels, retention mechanics, rapid experimentation opportunities, and scalable growth levers.",
  "content-creator":
    "Approach this as a content creator: focus on audience-first storytelling, platform-native formats, engagement optimization, and authentic brand voice.",
  "compliance-auditor":
    "Audit for compliance: identify regulatory risks, flag potential legal exposure, suggest audit trails, and ensure policy adherence.",
  "security-engineer":
    "Apply a security engineering mindset: threat modeling, vulnerability identification, secure design principles, authentication hardening, and attack surface reduction.",
  "devops-automator":
    "Think DevOps: CI/CD pipelines, infrastructure-as-code, monitoring and observability, incident response playbooks, and automation opportunities.",
  "reality-checker":
    "Be a reality checker: cut through hype, stress-test assumptions, identify blind spots, surface hidden risks, and ask the hard questions.",
  "trend-researcher":
    "As a trend researcher: identify emerging signals, market timing opportunities, early-mover advantages, and competitive intelligence gaps.",
  "data-analytics-reporter":
    "Think in data: structure the analysis with clear metrics, frame insights with numbers, identify what KPIs matter, and suggest data-driven next steps.",
  "backend-architect":
    "Apply backend architecture thinking: system design patterns, API contracts, scalability concerns, database schema considerations, and technical debt.",
  "frontend-developer":
    "Apply frontend engineering thinking: component architecture, state management, accessibility, performance optimization, and user experience craftsmanship.",
  "rapid-prototyper":
    "Move fast and iterate: identify the fastest path to a working demo, what to cut for v1, and how to validate assumptions before building the full system.",
  "autonomous-optimization-architect":
    "Think as an autonomous optimization architect: identify where AI agents can replace manual work, what feedback loops can be automated, and how to build self-improving systems.",
};


// ─── Default fallback model ───────────────────────────────────────────────────

const INFERENCE_MODEL = "claude-sonnet";

// ─── Resolve model from session config ───────────────────────────────────────

function resolveModel(sessionModel?: string): { model: string; thinking?: boolean } {
  if (!sessionModel) return { model: INFERENCE_MODEL };
  // Handle our internal thinking marker
  if (sessionModel.endsWith(":thinking")) {
    return { model: resolveModel(sessionModel.replace(":thinking", "")).model, thinking: true };
  }
  if (sessionModel.includes("opus")) return { model: "claude-opus" };
  if (sessionModel.includes("sonnet")) return { model: "claude-sonnet" };
  if (sessionModel.includes("gpt-5")) return { model: "codex-frontier" };
  if (sessionModel.includes("gemini") && sessionModel.includes("flash")) return { model: "gemini-flash" };
  if (sessionModel.includes("gemini")) return { model: "gemini-pro" };
  return { model: resolveProviderModelId(sessionModel) };
}

// ─── Agent spawning ──────────────────────────────────────────────────────────

// Session ID extracted from the active file path context
let _activeSessionId = "";

function setActiveSessionId(sessionId: string) {
  _activeSessionId = sessionId;
}

/**
 * Generate one advisory agent turn through the configured model router.
 */
async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  modelStr: string,
  thinking: boolean | string = false,
  _maxTokensOverride?: number,
  agentId?: string
): Promise<string> {
  const thinkingLevel =
    typeof thinking === "string"
      ? (thinking as "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max")
      : thinking
      ? "medium"
      : undefined;
  const result = await spawnAdvisoryAgentWithRetry({
    sessionId: _activeSessionId,
    agentId: agentId || "system",
    systemPrompt,
    userPrompt,
    timeoutSeconds: 300,
    thinkingLevel,
    model: modelStr,
  });
  return result.text;
}

async function callAgent(
  systemPrompt: string,
  userPrompt: string,
  modelStr: string,
  thinking: boolean | string = false,
  _maxTokensOverride?: number,
  agentId?: string,
  onTextChunk?: (chunk: string) => void
): Promise<SpawnAdvisoryAgentResult> {
  const thinkingLevel =
    typeof thinking === "string"
      ? (thinking as "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max")
      : thinking
      ? "medium"
      : undefined;
  return spawnAdvisoryAgentWithRetry({
    sessionId: _activeSessionId,
    agentId: agentId || "system",
    systemPrompt,
    userPrompt,
    timeoutSeconds: 300,
    thinkingLevel,
    model: modelStr,
    onTextChunk,
  });
}

// ─── Response length settings ─────────────────────────────────────────────────

export type ResponseLength = "concise" | "balanced" | "detailed" | "verbose";

const RESPONSE_LENGTH_CONFIG: Record<ResponseLength, { maxTokens: number; instruction: string }> = {
  concise: {
    maxTokens: 1024,
    instruction: "Be brief and punchy — 1-2 focused paragraphs max.",
  },
  balanced: {
    maxTokens: 2048,
    instruction: "Give thorough but focused responses — 2-3 paragraphs.",
  },
  detailed: {
    maxTokens: 3072,
    instruction: "Give comprehensive analysis — 3-5 paragraphs with supporting detail.",
  },
  verbose: {
    maxTokens: 4096,
    instruction: "Give exhaustive analysis — cover every angle in depth.",
  },
};

const DEFAULT_RESPONSE_LENGTH: ResponseLength = "balanced";

// ─── Build agent system prompt ────────────────────────────────────────────────

// ─── Personality trait injection ──────────────────────────────────────────────

const TRAIT_DESCRIPTIONS: Record<string, string> = {
  Skeptical: "Question every assumption aggressively. Demand hard evidence before accepting any claim. Flag weak logic, hand-waving, and wishful thinking without mercy.",
  Encouraging: "Amplify good ideas and build your teammates up. Lead with genuine positivity, but always pair it with substance — cheerleading without insight is worthless.",
  Difficult: "Be the toughest person in the room. Challenge everything, push back hard, and make people earn their conclusions. Don't let anything slide uncontested.",
  Shy: "Hold back. Only speak when you have something genuinely critical to add. Be sparing with your words — your silence is as meaningful as your voice.",
  Bold: "Take big swings and make strong claims. Don't hedge — plant your flag and defend it. Speak with the conviction of someone who has done the homework.",
  Cautious: "Lead with risks before opportunities. Flag what could go wrong, what assumptions are unproven, what second-order effects haven't been considered. Be the voice of disciplined restraint.",
  Provocative: "Stir the pot deliberately. Say the uncomfortable thing nobody else will. Challenge conventional wisdom with sharp contrarian takes designed to surface hidden tensions.",
  Empathetic: "Center the human impact in every recommendation. Consider the downstream effects on people — team members, customers, stakeholders. Advocate for those whose voices aren't in the room.",
  Analytical: "Lead with data and structured first-principles reasoning. Break every claim into its components. Show your work. Unpack assumptions. Numbers before narratives.",
  Creative: "Think laterally and make unexpected connections. Propose unconventional solutions that others wouldn't consider. Prioritize originality over safety.",
};

const COMM_STYLE_DESCRIPTIONS: Record<string, string> = {
  Verbose: "Give full analysis — multiple paragraphs, extensive supporting detail, thorough coverage of all angles. Leave nothing unsaid.",
  Concise: "Absolute minimum. One key point, one concrete recommendation. Cut everything else. If it can be said in one sentence, say it in one sentence.",
  Thoughtful: "Measured and deliberate. Pause to consider before asserting. Qualify claims where genuinely uncertain. Prioritize precision over speed.",
  "Rapid-fire": "Short punchy sentences only. Fire rapid volleys. Build momentum through speed. No essays — maximum one paragraph per point.",
};

function buildPersonalityBlock(
  traits: string[],
  commStyle: string | undefined,
  intensity: number | undefined
): string {
  if (!traits?.length && !commStyle && intensity == null) return "";

  const lines: string[] = ["\n**Personality configuration for this session (overrides your default style):**"];

  if (traits?.length > 0) {
    lines.push(`\n**Active traits:** ${traits.join(", ")}`);
    for (const t of traits) {
      const desc = TRAIT_DESCRIPTIONS[t];
      if (desc) lines.push(`- *${t}*: ${desc}`);
    }
  }

  if (commStyle && COMM_STYLE_DESCRIPTIONS[commStyle]) {
    lines.push(`\n**Communication style:** ${commStyle} — ${COMM_STYLE_DESCRIPTIONS[commStyle]}`);
  }

  if (intensity != null) {
    const clampedIntensity = Math.max(1, Math.min(10, Math.round(intensity)));
    const intensityLabel =
      clampedIntensity <= 3 ? "Gentle" :
      clampedIntensity <= 6 ? "Moderate" :
      clampedIntensity <= 8 ? "Assertive" : "Aggressive";
    lines.push(`\n**Intensity: ${clampedIntensity}/10 (${intensityLabel})** — ${
      clampedIntensity <= 3
        ? "Be diplomatic and collegial. Choose words carefully. Preserve relationships."
        : clampedIntensity <= 6
        ? "Direct but professional. Standard advisory intensity."
        : clampedIntensity <= 8
        ? "Forceful and confident. Push hard. Don't soften your opinions."
        : "Uncompromising and confrontational. Refuse to soften. Don't back down from friction."
    }`);
  }

  lines.push("\nThese modifiers are in effect for the entire session. Let them shape your voice noticeably.");
  return lines.join("\n");
}

/**
 * Build a system prompt for an agent, injecting their unique persona and optional overlay.
 * @param agentId - Agent identifier (advisory display name, e.g. "Henry", "Atlas")
 * @param mode - Session mode
 * @param topic - Session topic
 * @param agentOverlay - Optional overlay ID assigned to this specific agent (or undefined)
 * @param responseLength - Response length setting
 * @param personalityTraits - Per-agent personality trait pills
 * @param communicationStyle - Per-agent communication style
 * @param intensityLevel - Per-agent intensity (1–10)
 */
function buildSystemPrompt(
  agentId: string,
  mode: string,
  topic: string,
  agentOverlay?: string,
  responseLength?: ResponseLength,
  extendedThinking?: boolean,
  referenceContext?: string,
  personalityTraits?: string[],
  communicationStyle?: string,
  intensityLevel?: number
): string {
  const agent = AGENT_DEFS[agentId];
  if (!agent) {
    const referenceBlock = referenceContext
      ? `\n\n**Approved plan and source material for this session:**\n${referenceContext}\n`
      : "";
    const lengthConfig = RESPONSE_LENGTH_CONFIG[responseLength || DEFAULT_RESPONSE_LENGTH];
    const personalityBlock = buildPersonalityBlock(personalityTraits || [], communicationStyle, intensityLevel);
    return `You are ${agentId}, a temporary AI advisor created specifically for this Panely session.

You are participating in a ${mode} session about:

**Topic:** ${topic}
${referenceBlock}${personalityBlock}
**Response length:** ${lengthConfig.instruction}

Use the approved plan to understand your exact role, stance, and assignment. Speak only as ${agentId}. Be concrete, opinionated, and useful. Reference other advisors by their generated names when responding to them. Do not mention legacy agent names, hidden execution slots, or implementation details.`;
  }

  const referenceBlock = referenceContext
    ? `\n\n**Reference material provided for this session:**\n${referenceContext}\n`
    : "";

  const overlayContent = agentOverlay ? PERSONA_CONTENT[agentOverlay] : null;
  const overlayLine = overlayContent ? `\nSpecialized lens for this session:\n- ${overlayContent}\n` : "";

  // Inject memory from previous sessions
  const memoryEntries = getAgentMemory(agentId, 5);
  const memoryBlock = formatMemoryForPrompt(memoryEntries);

  const lengthConfig = RESPONSE_LENGTH_CONFIG[responseLength || DEFAULT_RESPONSE_LENGTH];
  const lengthInstruction = lengthConfig.instruction;

  const personalityBlock = buildPersonalityBlock(personalityTraits || [], communicationStyle, intensityLevel);

  // ── Roundtable mode (default) ─────────────────────────────────────────────
  return `${agent.persona}

---

You are ${agent.name} ${agent.emoji}, the ${agent.role} in Panely, an AI advisory room. You are participating in a roundtable discussion on the following topic:

**Topic:** ${topic}
${overlayLine}${memoryBlock}${referenceBlock}${personalityBlock}
**Response length:** ${lengthInstruction}

**Core advisory directives:**
- Speak in YOUR AUTHENTIC VOICE — your unique persona, vocabulary, and mental models should be immediately recognizable. Atlas sounds like a quant trader. Cipher sounds on-chain. Counsel sounds like a careful lawyer. Don't blend into generic AI assistant mode.
- Speak authoritatively from your area of expertise with SPECIFIC examples, data points, metrics, and actionable recommendations
- **Reference other participants by name** when responding to their points. Say things like "Building on what Atlas proposed about volatility surfaces..." or "I'd push back on Cipher's assumption that..." or "Scout's signal on X is interesting — here's the implication for my domain..."
- Be strongly opinionated — you have deep expertise and a real perspective. Don't hedge or be wishy-washy.
- Propose concrete next steps, timelines, and resource requirements
- Identify risks, tradeoffs, and second-order effects that others might miss
- Use your specialized knowledge to go DEEP — surface-level observations are not acceptable
- Don't repeat what others have already said — always add new substantive value
- Never use filler phrases like "Great point!" or "I agree" — just dive straight into your analysis
- This is a conversation, not a series of independent monologues — engage with what others have actually said

**Critical instruction on group dynamics:** If all participants seem to be agreeing or converging on the same direction, one agent should naturally play devil's advocate and push back with counter-arguments, risks, or alternative perspectives. Healthy disagreement produces better decisions than echo chambers. Don't agree for the sake of harmony — if something deserves scrutiny, provide it.

This is a high-stakes advisory session. The user is counting on this board to make real decisions. Respond as ${agent.name} would at their absolute best.${extendedThinking ? `

**Extended Thinking Mode:** Think step-by-step and show your reasoning process. Break down complex problems into components, evaluate each one explicitly, consider counter-arguments, and make your logic chain visible before reaching conclusions.` : ""}`;
}

// ─── Build conversation history string ───────────────────────────────────────

function buildHistoryString(
  events: Array<{ speaker: string; text: string; type: string; emoji?: string; role?: string }>
): string {
  const relevant = events.filter(
    (e) => e.type !== "start" && e.type !== "complete" && e.text
  );
  if (relevant.length === 0) return "No prior discussion yet.";
  return relevant
    .map((e) => {
      if (e.type === "human-directive" || e.speaker === "the user") {
        return `═══ USER ═══\n${e.text.replace(/\*\*/g, "")}\n\n[Note: The user is the human decision-maker. Engage with their input directly — acknowledge their point, answer their question, or build on their idea.]`;
      }
      const agentDef = AGENT_DEFS[e.speaker];
      const roleLabel = agentDef ? `${agentDef.role}` : (e.role || "Agent");
      return `═══ ${e.speaker.toUpperCase()} (${roleLabel}) ═══\n${e.text.replace(/\*\*/g, "")}`;
    })
    .join("\n\n---\n\n");
}

// ─── Auto-title generation ────────────────────────────────────────────────────

/**
 * Generate a short descriptive title for a session based on its topic and first few responses.
 * Stores the title in the session JSON.
 */
async function generateSessionTitle(
  filePath: string,
  topic: string,
  firstEvents: Array<{ speaker: string; text: string }>,
  model: string
): Promise<void> {
  try {
    // Only generate if no title exists yet
    const raw = fs.readFileSync(filePath, "utf-8");
    const session = JSON.parse(raw);
    if (session.title) return; // already titled

    const snippets = firstEvents
      .slice(0, 3)
      .map((e) => `${e.speaker}: ${e.text.slice(0, 200)}`)
      .join("\n\n");

    const titlePrompt = `Generate a short, punchy, descriptive title for an advisory board session.

Topic: ${topic}

First responses:
${snippets}

Rules:
- 4-8 words maximum
- Descriptive and specific (not generic like "Advisory Session" or "Discussion")
- Captures the core theme or decision being explored
- No punctuation at the end
- No quotes around the title
- Just output the title, nothing else

Example good titles:
- Q3 Trading Strategy Pivot Analysis
- Insight Platform Security Architecture Review  
- DeFi Yield Optimization for Volatile Markets
- Panely Artifact Workflow Review`;

    const titleRaw = await callClaude(
      "You are a concise title generator. Output only the title, nothing else.",
      titlePrompt,
      model,
      false,
      50,
      "system"
    );
    const title = titleRaw.trim()
      .replace(/^["']|["']$/g, "") // strip surrounding quotes
      .replace(/[.!?]$/, "") // strip trailing punctuation
      .slice(0, 80); // hard cap

    if (title && title.length > 3) {
      const updatedRaw = fs.readFileSync(filePath, "utf-8");
      const updatedSession = JSON.parse(updatedRaw);
      updatedSession.title = title;
      fs.writeFileSync(filePath, JSON.stringify(updatedSession, null, 2));
    }
  } catch (err) {
    // Non-critical — just log and continue
    console.warn("[Advisory] Auto-title generation failed:", err);
  }
}

// ─── Append event to session file ────────────────────────────────────────────

function appendEvent(
  sessionPath: string,
  event: Record<string, unknown>
) {
  const raw = fs.readFileSync(sessionPath, "utf-8");
  const session = JSON.parse(raw);
  session.events = [...(session.events || []), event];
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
}

function updateEvent(
  sessionPath: string,
  eventId: string,
  updater: (event: Record<string, unknown>) => Record<string, unknown>
) {
  const raw = fs.readFileSync(sessionPath, "utf-8");
  const session = JSON.parse(raw);
  const events = Array.isArray(session.events) ? session.events : [];
  session.events = events.map((event: Record<string, unknown>) =>
    event.id === eventId ? updater(event) : event
  );
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
}

function createStreamingTextUpdater(sessionPath: string, eventId: string) {
  let text = "";
  let lastWrite = 0;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    pendingTimer = null;
    lastWrite = Date.now();
    const currentText = text;
    updateEvent(sessionPath, eventId, (event) => ({
      ...event,
      text: currentText,
      updatedAt: new Date().toISOString(),
    }));
  };

  return {
    append(chunk: string) {
      text += chunk;
      const elapsed = Date.now() - lastWrite;
      if (elapsed >= 350) {
        if (pendingTimer) {
          clearTimeout(pendingTimer);
          pendingTimer = null;
        }
        flush();
      } else if (!pendingTimer) {
        pendingTimer = setTimeout(flush, 350 - elapsed);
      }
    },
    finish(finalText: string, modelSource: string) {
      text = finalText;
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      updateEvent(sessionPath, eventId, (event) => ({
        ...event,
        text: finalText,
        model: modelSource,
        modelSource,
        streaming: false,
        updatedAt: new Date().toISOString(),
      }));
    },
    fail(errorText: string, meta?: { errorKind?: string; durationMs?: number; attemptId?: string; phase?: string }) {
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      updateEvent(sessionPath, eventId, (event) => ({
        ...event,
        type: "error",
        text: errorText,
        streaming: false,
        error: true,
        ...meta,
        updatedAt: new Date().toISOString(),
      }));
    },
  };
}

// ─── Set/clear thinking agent ─────────────────────────────────────────────────

function setThinkingAgent(sessionPath: string, agentId: string | null) {
  try {
    const raw = fs.readFileSync(sessionPath, "utf-8");
    const session = JSON.parse(raw);
    session.thinkingAgent = agentId;
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  } catch {
    // ignore — non-critical
  }
}

function setRunInProgress(sessionPath: string, inProgress: boolean) {
  try {
    const raw = fs.readFileSync(sessionPath, "utf-8");
    const session = JSON.parse(raw);
    session.runInProgress = inProgress;
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  } catch (err) {
    console.warn("[Advisory] Failed to set runInProgress:", err);
  }
}

function updateSessionRecord(
  sessionPath: string,
  updater: (session: Record<string, unknown>) => void
) {
  const raw = fs.readFileSync(sessionPath, "utf-8");
  const session = JSON.parse(raw);
  updater(session);
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  return session;
}

function beginAttempt(sessionPath: string, input: RunAttemptStartInput) {
  let attemptId = "";
  updateSessionRecord(sessionPath, (session) => {
    const attempt = startRunAttempt(session, input);
    attemptId = attempt.id;
  });
  return attemptId;
}

function completeAttempt(
  sessionPath: string,
  attemptId: string,
  update: { status: "succeeded"; modelSource?: string } | { status: "failed"; error: unknown }
): AdvisoryRunAttempt | null {
  let completed: AdvisoryRunAttempt | null = null;
  updateSessionRecord(sessionPath, (session) => {
    completed = finishRunAttempt(session, attemptId, update);
  });
  return completed as AdvisoryRunAttempt | null;
}

function beginRunStepRecord(sessionPath: string, input: {
  sessionId: string;
  index: number;
  phase: string;
  agentId: string;
  model: string;
  attemptId?: string;
}) {
  const step = createRunStep(input);
  updateSessionRecord(sessionPath, (session) => {
    const steps = Array.isArray(session.runSteps) ? (session.runSteps as AdvisoryRunStep[]) : [];
    session.runSteps = [...steps, step];
  });
  return step;
}

function updateRunStepRecord(
  sessionPath: string,
  stepId: string | undefined,
  updater: (step: AdvisoryRunStep) => AdvisoryRunStep
) {
  if (!stepId) return;
  updateSessionRecord(sessionPath, (session) => {
    const steps = Array.isArray(session.runSteps) ? (session.runSteps as AdvisoryRunStep[]) : [];
    session.runSteps = steps.map((step) => step.id === stepId ? updater(step) : step);
  });
}

function writeFormalArtifact(state: FormalBoardState, fileName: string, content: string) {
  if (!state.artifactDir) return;
  const artifactDir = path.isAbsolute(state.artifactDir)
    ? state.artifactDir
    : path.join(process.cwd(), state.artifactDir);
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(path.join(artifactDir, fileName), content);
}

function writeFormalStateSnapshot(state: FormalBoardState) {
  writeFormalArtifact(state, "formal-board-state.json", JSON.stringify(state, null, 2));
}

function safeArtifactName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "seat";
}

function eventFailureText(label: string, err: unknown) {
  const classified = classifyProviderError(err);
  return {
    text: `⚠️ ${label}: ${classified.message}`,
    errorKind: classified.kind,
  };
}

// ─── Pacing helpers ───────────────────────────────────────────────────────────

async function waitForUnpause(sessionPath: string): Promise<boolean> {
  while (true) {
    const raw = fs.readFileSync(sessionPath, "utf-8");
    const s = JSON.parse(raw);
    if (s.status !== "active") return false;
    if (!s.paused) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function applyPacing(sessionPath: string, pacing: string): Promise<boolean> {
  if (pacing === "relaxed") {
    await new Promise((r) => setTimeout(r, 5_000));
  } else if (pacing === "slow") {
    await new Promise((r) => setTimeout(r, 15_000));
  } else if (pacing === "manual") {
    const raw = fs.readFileSync(sessionPath, "utf-8");
    const s = JSON.parse(raw);
    if (s.status !== "active") return false;
    s.paused = true;
    fs.writeFileSync(sessionPath, JSON.stringify(s, null, 2));
    const ok = await waitForUnpause(sessionPath);
    return ok;
  }
  const raw = fs.readFileSync(sessionPath, "utf-8");
  const s = JSON.parse(raw);
  return s.status === "active";
}

// ─── Get per-agent overlay ────────────────────────────────────────────────────

/**
 * Extract the overlay ID for a given agent from the personaOverlays config.
 * Supports both the new object format { agentId: overlayId } and the legacy array format.
 */
function getAgentOverlay(
  personaOverlays: Record<string, string> | string[] | undefined,
  agentId: string
): string | undefined {
  if (!personaOverlays) return undefined;
  if (Array.isArray(personaOverlays)) {
    // Legacy array format — check if any overlay is relevant for this agent
    // We don't know which overlay was meant for which agent in legacy format
    // so just return undefined (graceful degradation)
    return undefined;
  }
  return personaOverlays[agentId];
}

// ─── Main run endpoint ────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const filePath = path.join(DATA_DIR, `${id}.json`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Read session config
    let raw: string;
    let session: Record<string, unknown>;
    try {
      raw = fs.readFileSync(filePath, "utf-8");
      session = JSON.parse(raw);
    } catch (parseErr) {
      return NextResponse.json({ error: `Failed to read session: ${String(parseErr)}` }, { status: 500 });
    }

    const {
      topic,
      mode,
      agents,
      personaOverlays,
      rounds = 3,
      pacing = "instant",
      model: sessionModel,
      responseLength,
      extendedThinking: sessionExtendedThinking,
      referenceContext: sessionReferenceContext,
      agentPersonalityTraits: sessionAgentTraits,
      agentCommunicationStyles: sessionAgentCommStyles,
      agentIntensityLevels: sessionAgentIntensity,
      agentResponseLengths: sessionAgentResponseLengths,
      agentModelOverrides: sessionAgentModelOverrides,
      agentThinkingLevels: sessionAgentThinkingLevels,
    } = session;

    if (!agents || (agents as string[]).length === 0) {
      return NextResponse.json({ error: "No agents in session" }, { status: 400 });
    }

    const { model: resolvedModel, thinking: modelThinking } = resolveModel(sessionModel as string | undefined);
    // Extended thinking is enabled via model suffix OR the explicit toggle
    const thinking = modelThinking || (sessionExtendedThinking === true);
    const resolvedLength = (responseLength as ResponseLength | undefined) || DEFAULT_RESPONSE_LENGTH;

    // Run asynchronously — return immediately so the client can start polling
  const runConversation = async () => {
    // Set session ID for real agent spawning
    setActiveSessionId(id);
    setRunInProgress(filePath, true);
    try {
        if (mode === "roundtable") {
          await runRoundtable(
            filePath, session, topic as string, agents as string[],
            personaOverlays as Record<string, string> | string[] | undefined,
            rounds as number | string, pacing as string, resolvedModel, thinking, resolvedLength,
            sessionReferenceContext as string | undefined,
            sessionAgentTraits as Record<string, string[]> | undefined,
            sessionAgentCommStyles as Record<string, string> | undefined,
            sessionAgentIntensity as Record<string, number> | undefined,
            sessionAgentResponseLengths as Record<string, string> | undefined,
            sessionAgentModelOverrides as Record<string, string> | undefined,
            sessionAgentThinkingLevels as Record<string, string> | undefined
          );
        } else if (mode === "competitive") {
          await runCompetitive(
            filePath, session, topic as string, agents as string[],
            personaOverlays as Record<string, string> | string[] | undefined,
            pacing as string, resolvedModel, thinking, resolvedLength,
            sessionReferenceContext as string | undefined,
            sessionAgentTraits as Record<string, string[]> | undefined,
            sessionAgentCommStyles as Record<string, string> | undefined,
            sessionAgentIntensity as Record<string, number> | undefined,
            sessionAgentResponseLengths as Record<string, string> | undefined,
            sessionAgentModelOverrides as Record<string, string> | undefined,
            sessionAgentThinkingLevels as Record<string, string> | undefined
          );
        } else if (mode === "formal-board") {
          await runFormalBoard(
            filePath, session, topic as string, agents as string[],
            personaOverlays as Record<string, string> | string[] | undefined,
            pacing as string, resolvedModel, thinking, resolvedLength,
            sessionReferenceContext as string | undefined,
            sessionAgentTraits as Record<string, string[]> | undefined,
            sessionAgentCommStyles as Record<string, string> | undefined,
            sessionAgentIntensity as Record<string, number> | undefined,
            sessionAgentResponseLengths as Record<string, string> | undefined,
            sessionAgentModelOverrides as Record<string, string> | undefined,
            sessionAgentThinkingLevels as Record<string, string> | undefined
          );
        } else {
          throw new Error(`Unsupported advisory session mode: ${String(mode)}`);
        }
      } catch (err) {
        console.error("[Advisory] Run error:", err);
        try {
          // Classify the error for better UX
          const errMsg = String(err);
          const isGatewayDown = errMsg.includes("ECONNREFUSED") ||
            errMsg.includes("fetch failed") ||
            errMsg.includes("network") ||
            errMsg.includes("Gateway unreachable");
          const isRateLimit = errMsg.includes("429");
          const isServerError = errMsg.includes("500") || errMsg.includes("503");

          let userMessage: string;
          if (isGatewayDown) {
            userMessage = "⚠️ **Model gateway is offline.** The configured model provider is not responding. Please check your API key/network and try again.";
          } else if (isRateLimit) {
            userMessage = "⚠️ **Rate limit reached.** The API is temporarily rate-limiting requests. Please wait a moment and retry.";
          } else if (isServerError) {
            userMessage = `⚠️ **Server error.** The API returned an error. Please try again.\n\nDetails: ${errMsg}`;
          } else {
            userMessage = `⚠️ **Session error.** An unexpected error occurred.\n\nDetails: ${errMsg}`;
          }

          const errEvent = {
            id: `evt_err_${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: "error",
            speaker: "System",
            emoji: "⚠️",
            role: "supervisor" as const,
            text: userMessage,
            error: true,
            model: resolvedModel,
          };
          appendEvent(filePath, errEvent);

          // Mark session status so UI knows it's stuck
          try {
            const sessRaw = fs.readFileSync(filePath, "utf-8");
            const sess = JSON.parse(sessRaw);
            sess.lastError = errMsg;
            sess.thinkingAgent = null;
            sess.runInProgress = false;
            fs.writeFileSync(filePath, JSON.stringify(sess, null, 2));
          } catch {
            // ignore
          }
        } catch {
          // ignore write errors
        }
      } finally {
        setRunInProgress(filePath, false);
      }
    };

    // Fire and forget
    runConversation().catch(console.error);

    return NextResponse.json({ ok: true, message: "Session conversation started" });
  } catch (err) {
    console.error("[Advisory] POST /run handler error:", err);
    return NextResponse.json(
      { error: `Internal server error: ${String(err)}` },
      { status: 500 }
    );
  }
}

// ─── Moderator prompt helpers ─────────────────────────────────────────────────

function buildModeratorSystemPrompt(
  agentId: string,
  topic: string,
  agentOverlay: string | undefined,
  responseLength: ResponseLength,
  thinking: boolean,
  referenceContext?: string,
  personalityTraits?: string[],
  communicationStyle?: string,
  intensityLevel?: number
): string {
  const agent = AGENT_DEFS[agentId];
  if (!agent) return `You are a moderator for a roundtable discussion about: ${topic}`;

  const basePrompt = buildSystemPrompt(
    agentId, "roundtable", topic, agentOverlay, responseLength, thinking, referenceContext,
    personalityTraits, communicationStyle, intensityLevel
  );

  return `${basePrompt}

---

**MODERATOR ROLE — YOU ARE THE SESSION MODERATOR.**

As moderator, you have special responsibilities beyond your advisory role:
- **Open sessions** with clear agenda framing: state the key questions, what success looks like, and how you'll structure the discussion
- **Interject between speakers** to keep discussion on track — redirect tangents, surface under-explored angles, and ensure all voices are heard
- **Summarize progress** mid-session: "Let me summarize where we are..." or "Here's what we've established so far..."
- **Challenge groupthink** when the board is converging too quickly without rigorous scrutiny
- **Deliver the final synthesis** with concrete conclusions and action items

Use distinct moderator framing in your responses:
- "Let me redirect us..." when the discussion drifts
- "Good point, but we're drifting..." to refocus
- "Let me summarize where we are..." for progress checks
- "Before we move on, I want to make sure we've addressed..." to ensure thoroughness
- "I'm going to push back on the emerging consensus here..." to challenge groupthink

You speak with authority but fairness. You don't dominate — you guide. Your job is to extract the best thinking from every participant and synthesize it into actionable conclusions for the user.`;
}

// ─── FORMAL BOARD REVIEW mode ───────────────────────────────────────────────

async function runFormalBoard(
  filePath: string,
  session: Record<string, unknown>,
  topic: string,
  agents: string[],
  _personaOverlays: Record<string, string> | string[] | undefined,
  pacing: string = "instant",
  model: string = INFERENCE_MODEL,
  thinking = false,
  responseLength: ResponseLength = DEFAULT_RESPONSE_LENGTH,
  referenceContext?: string,
  agentPersonalityTraits?: Record<string, string[]>,
  agentCommunicationStyles?: Record<string, string>,
  agentIntensityLevels?: Record<string, number>,
  agentResponseLengths?: Record<string, string>,
  agentModelOverrides?: Record<string, string>,
  agentThinkingLevels?: Record<string, string>
) {
  const sourcePacket = buildSourcePacket({ topic, referenceContext });
  const existingFormalBoard = session.formalBoard as FormalBoardState | undefined;
  let formalBoard = existingFormalBoard?.protocol === "advisory-board/formal@1"
    ? existingFormalBoard
    : createFormalBoardState({
        sessionId: String(session.id || path.basename(filePath, ".json")),
        agents,
        agentRoles: Object.fromEntries(agents.map((agentId) => [agentId, getSessionAgentIdentity(session, agentId).role])),
        agentModels: agentModelOverrides,
        sourcePacket,
      });

  updateSessionRecord(filePath, (current) => {
    current.formalBoard = formalBoard;
  });
  writeFormalArtifact(
    formalBoard,
    "source-packet.md",
    `<!-- source-packet-sha256: ${sourcePacket.hash} -->\n\n${sourcePacket.text}\n`
  );
  writeFormalStateSnapshot(formalBoard);

  if (!canRunFormalBoard(formalBoard)) {
    throw new Error("Formal Board Review requires at least two runnable seats.");
  }

  const updateFormalBoard = (updater: (state: FormalBoardState) => FormalBoardState) => {
    updateSessionRecord(filePath, (current) => {
      const state = (current.formalBoard as FormalBoardState | undefined) || formalBoard;
      formalBoard = updater(state);
      current.formalBoard = formalBoard;
    });
    writeFormalStateSnapshot(formalBoard);
  };

  const sessionId = String(session.id || path.basename(filePath, ".json"));
  let stepIndex = Array.isArray(session.runSteps) ? session.runSteps.length : 0;

  appendEvent(filePath, {
    id: `evt_formal_round1_${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: "start",
    speaker: "System",
    emoji: "🧾",
    role: "system",
    text: `**Formal Board Review — Round 1: Independent Review**\n\nEach seat receives the same source packet only. Peer output is hidden until Round 2.\n\nSource packet SHA-256: \`${sourcePacket.hash}\``,
    phase: "formal-round-1",
  });
  updateFormalBoard((state) => setFormalBoardPhase(state, "round-1"));

  for (const agentId of agents) {
    const currentRaw = fs.readFileSync(filePath, "utf-8");
    const currentSession = JSON.parse(currentRaw);
    if (currentSession.status !== "active") return;

    const identity = getSessionAgentIdentity(session, agentId);
    const agentLength = (agentResponseLengths?.[agentId] as ResponseLength | undefined) || responseLength;
    const agentModel = resolveModel(agentModelOverrides?.[agentId] || model).model;
    const agentThinking = agentThinkingLevels?.[agentId] || (thinking ? "medium" : undefined);
    const eventId = `evt_formal_r1_${agentId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const systemPrompt = buildFormalRoundOneSystemPrompt({
      agentName: agentId,
      role: identity.role,
      responseInstruction: RESPONSE_LENGTH_CONFIG[agentLength].instruction,
    });
    const userPrompt = buildFormalRoundOneUserPrompt(sourcePacket);

    appendEvent(filePath, {
      id: eventId,
      timestamp: new Date().toISOString(),
      type: "worker",
      speaker: agentId,
      emoji: identity.emoji,
      role: "worker",
      text: "",
      model: agentModel,
      modelSource: agentModel,
      provenance: eventProvenance(agentModel),
      streaming: true,
      phase: "formal-round-1",
    });

    const attemptId = beginAttempt(filePath, { phase: "formal-round-1", agentId, model: agentModel });
    const step = beginRunStepRecord(filePath, {
      sessionId,
      index: stepIndex++,
      phase: "formal-round-1",
      agentId,
      model: agentModel,
      attemptId,
    });
    const streamUpdater = createStreamingTextUpdater(filePath, eventId);
    setThinkingAgent(filePath, agentId);

    try {
      const result = await callAgent(
        systemPrompt,
        userPrompt,
        agentModel,
        agentThinking || false,
        RESPONSE_LENGTH_CONFIG[agentLength].maxTokens,
        agentId,
        streamUpdater.append
      );
      const completed = completeAttempt(filePath, attemptId, { status: "succeeded", modelSource: result.model });
      updateRunStepRecord(filePath, step?.id, (runStep) => completeRunStep({
        ...runStep,
        provenance: eventProvenance(agentModel, result.model),
      }));
      streamUpdater.finish(result.text, result.model);
      updateEvent(filePath, eventId, (event) => ({
        ...event,
        attemptId,
        durationMs: completed?.durationMs,
        phase: "formal-round-1",
        provenance: eventProvenance(agentModel, result.model),
      }));
      updateFormalBoard((state) => recordFormalRoundArtifact(state, {
        round: 1,
        agentId,
        status: "ran",
        text: result.text,
        model: result.model,
        attemptId,
      }));
      writeFormalArtifact(formalBoard, `round-1-${safeArtifactName(agentId)}.md`, result.text);
    } catch (err) {
      const completed = completeAttempt(filePath, attemptId, { status: "failed", error: err });
      const failure = eventFailureText("Formal Round 1 failed", err);
      updateRunStepRecord(filePath, step?.id, (runStep) => failRunStep(runStep, { errorKind: failure.errorKind, error: failure.text }));
      streamUpdater.fail(failure.text, {
        errorKind: failure.errorKind,
        durationMs: completed?.durationMs,
        attemptId,
        phase: "formal-round-1",
      });
      updateFormalBoard((state) => recordFormalRoundArtifact(state, {
        round: 1,
        agentId,
        status: "degraded",
        text: failure.text,
        model: agentModel,
        attemptId,
        errorKind: failure.errorKind,
      }));
      writeFormalArtifact(formalBoard, `round-1-${safeArtifactName(agentId)}.md`, failure.text);
    } finally {
      setThinkingAgent(filePath, null);
    }

    await new Promise((r) => setTimeout(r, 500));
    const continueSession = await applyPacing(filePath, pacing);
    if (!continueSession) return;
  }

  const successfulRoundOne = formalBoard.rounds.filter((artifact) => artifact.round === 1 && artifact.status === "ran");

  appendEvent(filePath, {
    id: `evt_formal_round2_${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: "start",
    speaker: "System",
    emoji: "🔎",
    role: "system",
    text: `**Formal Board Review — Round 2: Rebuttal**\n\n${successfulRoundOne.length} independent Round 1 seats completed. Seats now receive the shared Round 1 packet and may update, challenge, or dissent.`,
    phase: "formal-round-2",
  });
  updateFormalBoard((state) => setFormalBoardPhase(state, "round-2"));

  if (successfulRoundOne.length >= 2) {
    for (const agentId of agents) {
      const currentRaw = fs.readFileSync(filePath, "utf-8");
      const currentSession = JSON.parse(currentRaw);
      if (currentSession.status !== "active") return;

      const identity = getSessionAgentIdentity(session, agentId);
      const agentLength = (agentResponseLengths?.[agentId] as ResponseLength | undefined) || responseLength;
      const agentModel = resolveModel(agentModelOverrides?.[agentId] || model).model;
      const agentThinking = agentThinkingLevels?.[agentId] || (thinking ? "medium" : undefined);
      const eventId = `evt_formal_r2_${agentId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const systemPrompt = buildFormalRoundTwoSystemPrompt({
        agentName: agentId,
        role: identity.role,
        responseInstruction: RESPONSE_LENGTH_CONFIG[agentLength].instruction,
      });
      const userPrompt = buildFormalRoundTwoUserPrompt({
        topic,
        sourcePacketHash: sourcePacket.hash,
        roundOneArtifacts: successfulRoundOne,
      });

      appendEvent(filePath, {
        id: eventId,
        timestamp: new Date().toISOString(),
        type: "reviewer",
        speaker: agentId,
        emoji: identity.emoji,
        role: "reviewer",
        text: "",
        model: agentModel,
        modelSource: agentModel,
        provenance: eventProvenance(agentModel),
        streaming: true,
        phase: "formal-round-2",
      });

      const attemptId = beginAttempt(filePath, { phase: "formal-round-2", agentId, model: agentModel });
      const step = beginRunStepRecord(filePath, {
        sessionId,
        index: stepIndex++,
        phase: "formal-round-2",
        agentId,
        model: agentModel,
        attemptId,
      });
      const streamUpdater = createStreamingTextUpdater(filePath, eventId);
      setThinkingAgent(filePath, agentId);

      try {
        const result = await callAgent(
          systemPrompt,
          userPrompt,
          agentModel,
          agentThinking || false,
          RESPONSE_LENGTH_CONFIG[agentLength].maxTokens,
          agentId,
          streamUpdater.append
        );
        const completed = completeAttempt(filePath, attemptId, { status: "succeeded", modelSource: result.model });
        updateRunStepRecord(filePath, step?.id, (runStep) => completeRunStep({
          ...runStep,
          provenance: eventProvenance(agentModel, result.model),
        }));
        streamUpdater.finish(result.text, result.model);
        updateEvent(filePath, eventId, (event) => ({
          ...event,
          attemptId,
          durationMs: completed?.durationMs,
          phase: "formal-round-2",
          provenance: eventProvenance(agentModel, result.model),
        }));
        updateFormalBoard((state) => recordFormalRoundArtifact(state, {
          round: 2,
          agentId,
          status: "ran",
          text: result.text,
          model: result.model,
          attemptId,
        }));
        writeFormalArtifact(formalBoard, `round-2-${safeArtifactName(agentId)}.md`, result.text);
      } catch (err) {
        const completed = completeAttempt(filePath, attemptId, { status: "failed", error: err });
        const failure = eventFailureText("Formal Round 2 failed", err);
        updateRunStepRecord(filePath, step?.id, (runStep) => failRunStep(runStep, { errorKind: failure.errorKind, error: failure.text }));
        streamUpdater.fail(failure.text, {
          errorKind: failure.errorKind,
          durationMs: completed?.durationMs,
          attemptId,
          phase: "formal-round-2",
        });
        updateFormalBoard((state) => recordFormalRoundArtifact(state, {
          round: 2,
          agentId,
          status: "degraded",
          text: failure.text,
          model: agentModel,
          attemptId,
          errorKind: failure.errorKind,
        }));
        writeFormalArtifact(formalBoard, `round-2-${safeArtifactName(agentId)}.md`, failure.text);
      } finally {
        setThinkingAgent(filePath, null);
      }

      await new Promise((r) => setTimeout(r, 500));
      const continueSession = await applyPacing(filePath, pacing);
      if (!continueSession) return;
    }
  }

  updateFormalBoard((state) => setFormalBoardPhase(state, "synthesis"));
  const synthesisPrompt = buildFormalSynthesisPrompt({
    topic,
    sourcePacketHash: sourcePacket.hash,
    artifacts: formalBoard.rounds,
    seats: formalBoard.seats,
  });
  const synthesisAgentId = agents[0];
  const synthesisModelId = resolveModel(agentModelOverrides?.[synthesisAgentId] || model).model;
  const synthesisThinking = agentThinkingLevels?.[synthesisAgentId] || (thinking ? "medium" : undefined);
  const synthesisAttemptId = beginAttempt(filePath, {
    phase: "formal-synthesis",
    agentId: synthesisAgentId,
    model: synthesisModelId,
  });
  const synthesisStep = beginRunStepRecord(filePath, {
    sessionId,
    index: stepIndex++,
    phase: "formal-synthesis",
    agentId: synthesisAgentId,
    model: synthesisModelId,
    attemptId: synthesisAttemptId,
  });

  let synthesisText = "";
  let synthesisModel = synthesisModelId;
  let synthesisDurationMs: number | undefined;
  let synthesisErrorKind: string | undefined;
  let synthesisError = false;
  setThinkingAgent(filePath, synthesisAgentId);
  try {
    const result = await callAgent(
      "You are the Formal Board clerk. Synthesize the board faithfully without inventing evidence.",
      synthesisPrompt,
      synthesisModelId,
      synthesisThinking || false,
      RESPONSE_LENGTH_CONFIG[responseLength].maxTokens,
      synthesisAgentId
    );
    synthesisText = result.text;
    synthesisModel = result.model;
    synthesisDurationMs = completeAttempt(filePath, synthesisAttemptId, { status: "succeeded", modelSource: result.model })?.durationMs;
    updateRunStepRecord(filePath, synthesisStep?.id, (runStep) => completeRunStep({
      ...runStep,
      provenance: eventProvenance(synthesisModelId, result.model),
    }));
  } catch (err) {
    const completed = completeAttempt(filePath, synthesisAttemptId, { status: "failed", error: err });
    const failure = eventFailureText("Could not generate formal synthesis", err);
    synthesisText = `## Verdict\nCAUTION\n\nFormal synthesis generation failed. Review the transcript and seat outputs manually.\n\n## Could not verify\n- ${failure.text}\n\n## Minority report\n- No model-generated minority report was produced because synthesis failed.`;
    synthesisErrorKind = failure.errorKind;
    synthesisDurationMs = completed?.durationMs;
    synthesisError = true;
    updateRunStepRecord(filePath, synthesisStep?.id, (runStep) => failRunStep(runStep, { errorKind: failure.errorKind, error: failure.text }));
  } finally {
    setThinkingAgent(filePath, null);
  }

  const verdict = buildFormalVerdict({ topic, synthesisText, state: formalBoard });
  updateFormalBoard((state) => ({
    ...setFormalBoardPhase(state, "complete"),
    verdict,
  }));
  writeFormalArtifact(formalBoard, "final-consensus.md", synthesisText);
  writeFormalArtifact(formalBoard, "verdict.json", JSON.stringify(verdict, null, 2));

  appendEvent(filePath, {
    id: `evt_formal_verdict_${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: "complete",
    speaker: synthesisAgentId,
    emoji: "🧾",
    role: "supervisor",
    text: `**Formal Board Verdict — ${verdict.verdict.toUpperCase()}**\n\n${synthesisText}\n\n---\n\n\`\`\`json\n${JSON.stringify(verdict, null, 2)}\n\`\`\``,
    verdict: verdict.verdict,
    model: synthesisModel,
    modelSource: synthesisModel,
    provenance: eventProvenance(synthesisModelId, synthesisError ? undefined : synthesisModel),
    error: synthesisError || undefined,
    errorKind: synthesisErrorKind,
    durationMs: synthesisDurationMs,
    attemptId: synthesisAttemptId,
    phase: "formal-synthesis",
  });

  const completedRaw = fs.readFileSync(filePath, "utf-8");
  const completedSession = JSON.parse(completedRaw);
  completedSession.status = "completed";
  completedSession.completedAt = new Date().toISOString();
  completedSession.outcome = "formal-board-complete";
  completedSession.thinkingAgent = null;
  completedSession.runInProgress = false;
  fs.writeFileSync(filePath, JSON.stringify(completedSession, null, 2));
}

// ─── ROUNDTABLE mode ──────────────────────────────────────────────────────────

async function runRoundtable(
  filePath: string,
  session: Record<string, unknown>,
  topic: string,
  agents: string[],
  personaOverlays: Record<string, string> | string[] | undefined,
  rounds: number | string = 3,
  pacing: string = "instant",
  model: string = INFERENCE_MODEL,
  thinking = false,
  responseLength: ResponseLength = DEFAULT_RESPONSE_LENGTH,
  referenceContext?: string,
  agentPersonalityTraits?: Record<string, string[]>,
  agentCommunicationStyles?: Record<string, string>,
  agentIntensityLevels?: Record<string, number>,
  agentResponseLengths?: Record<string, string>,
  agentModelOverrides?: Record<string, string>,
  agentThinkingLevels?: Record<string, string>
) {
  const isPersistent = rounds === "persistent";
  const moderatorId = session.moderator as string | undefined;

  // For persistent sessions: run exactly one round, then stay active
  const numRounds = isPersistent
    ? 1
    : typeof rounds === "number"
    ? rounds
    : parseInt(String(rounds), 10) || 3;

  // ── Moderator opening: agenda framing before round 1 ────────────────────────
  if (moderatorId && AGENT_DEFS[moderatorId]) {
    const checkRaw = fs.readFileSync(filePath, "utf-8");
    const checkSession = JSON.parse(checkRaw);
    if (checkSession.status !== "active") return;

    const modAgent = AGENT_DEFS[moderatorId];
    const modOverlay = getAgentOverlay(personaOverlays, moderatorId);
    const modSystemPrompt = buildModeratorSystemPrompt(
      moderatorId, topic, modOverlay, responseLength, thinking, referenceContext,
      agentPersonalityTraits?.[moderatorId],
      agentCommunicationStyles?.[moderatorId],
      agentIntensityLevels?.[moderatorId]
    );

    const participantList = agents
      .filter((a) => a !== moderatorId)
      .map((a) => {
        const def = AGENT_DEFS[a];
        return def ? `${def.name} ${def.emoji} (${def.role})` : a;
      })
      .join(", ");

    const openingPrompt = `You are moderating a roundtable session for User, Panely founder.

**Topic:** ${topic}

**Participants:** ${participantList}

**Rounds planned:** ${isPersistent ? "persistent (open-ended)" : numRounds}

Open the session now. Frame the agenda: what are the key questions we need to answer? What does success look like for this discussion? Briefly set expectations for the participants and kick things off. Be concise but authoritative — this is your opening statement as moderator.`;

    let openingText = "";
    let openingModel = model;
    const openingMaxTokens = RESPONSE_LENGTH_CONFIG[responseLength].maxTokens;
    const openingAttemptId = beginAttempt(filePath, {
      phase: "moderator-opening",
      agentId: moderatorId,
      model,
    });
    let openingDurationMs: number | undefined;
    let openingErrorKind: string | undefined;
    let openingError = false;
    setThinkingAgent(filePath, moderatorId);
    try {
      const result = await callAgent(modSystemPrompt, openingPrompt, model, thinking, openingMaxTokens, moderatorId);
      openingText = result.text;
      openingModel = result.model;
      openingDurationMs = completeAttempt(filePath, openingAttemptId, { status: "succeeded", modelSource: result.model })?.durationMs;
    } catch (err) {
      const completed = completeAttempt(filePath, openingAttemptId, { status: "failed", error: err });
      const failure = eventFailureText("Failed to generate moderator opening", err);
      openingText = failure.text;
      openingErrorKind = failure.errorKind;
      openingDurationMs = completed?.durationMs;
      openingError = true;
    }
    setThinkingAgent(filePath, null);

    appendEvent(filePath, {
      id: `evt_mod_open_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      type: openingError ? "error" : "worker",
      speaker: moderatorId,
      emoji: modAgent.emoji,
      role: "moderator" as const,
      text: openingText,
      model: openingModel,
      modelSource: openingModel,
      provenance: eventProvenance(model, openingError ? undefined : openingModel),
      error: openingError || undefined,
      errorKind: openingErrorKind,
      durationMs: openingDurationMs,
      attemptId: openingAttemptId,
      phase: "moderator-opening",
    });

    await new Promise((r) => setTimeout(r, 500));
    const continueAfterOpening = await applyPacing(filePath, pacing);
    if (!continueAfterOpening) return;
  }

  for (let round = 1; round <= numRounds; round++) {
    // Filter out moderator from regular turn order — they speak separately
    const roundAgents = moderatorId ? agents.filter((a) => a !== moderatorId) : agents;

    for (const agentId of roundAgents) {
      const currentRaw = fs.readFileSync(filePath, "utf-8");
      const currentSession = JSON.parse(currentRaw);
      const events = currentSession.events || [];

      if (currentSession.status !== "active") return;

      const history = buildHistoryString(events);
      const agentOverlay = getAgentOverlay(personaOverlays, agentId);
      const agentLength = (agentResponseLengths?.[agentId] as ResponseLength | undefined) || responseLength;
      const agentModel = resolveModel(agentModelOverrides?.[agentId] || model).model;
      const agentThinking = agentThinkingLevels?.[agentId] || (thinking ? "medium" : undefined);
      const systemPrompt = buildSystemPrompt(
        agentId, session.mode as string, topic, agentOverlay, agentLength, Boolean(agentThinking), referenceContext,
        agentPersonalityTraits?.[agentId],
        agentCommunicationStyles?.[agentId],
        agentIntensityLevels?.[agentId]
      );

      const isFirstTurn = events.filter((e: { speaker: string }) => e.speaker === agentId).length === 0;

      const recentEvents = events.filter((e: { type: string; text: string }) =>
        e.type === "worker" || e.type === "supervisor"
      ).slice(-4);
      const seemsLikeConsensus = recentEvents.length >= 2 && recentEvents.every((e: { text: string }) =>
        !e.text.toLowerCase().includes("however") &&
        !e.text.toLowerCase().includes("push back") &&
        !e.text.toLowerCase().includes("disagree") &&
        !e.text.toLowerCase().includes("concern") &&
        !e.text.toLowerCase().includes("risk")
      );
      const contrarianNote = seemsLikeConsensus && !isFirstTurn
        ? "\n\n**Note:** The previous speakers have all agreed on a direction. Challenge it. Present the strongest counter-argument or identify the risks they've glossed over. The user values diverse perspectives over consensus."
        : "";

      const userPrompt = isFirstTurn
        ? `Topic for this roundtable: ${topic}\n\n${history === "No prior discussion yet." ? "You are the first to speak. Open the discussion with your perspective." : `Previous discussion:\n\n${history}\n\nNow it's your turn to contribute.`}`
        : `Topic: ${topic}\n\nPrevious discussion:\n\n${history}\n\nYou've already spoken once. Now it's round ${round} — build on what's been said, push back on anything you disagree with, or take the discussion in a new direction.${contrarianNote}`;

      const lengthMaxTokens = RESPONSE_LENGTH_CONFIG[agentLength].maxTokens;
      const agent = AGENT_DEFS[agentId];
      const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      appendEvent(filePath, {
        id: eventId,
        timestamp: new Date().toISOString(),
        type: "worker",
        speaker: agentId,
        emoji: agent?.emoji || "💬",
        role: agentId === moderatorId ? ("moderator" as const) : agentId === "Henry" ? "supervisor" : "worker",
        text: "",
        model: agentModel,
        modelSource: agentModel,
        provenance: eventProvenance(agentModel),
        streaming: true,
      });

      const streamUpdater = createStreamingTextUpdater(filePath, eventId);
      const attemptId = beginAttempt(filePath, {
        phase: `roundtable-round-${round}`,
        agentId,
        model: agentModel,
      });
      setThinkingAgent(filePath, agentId);
      try {
        const result = await callAgent(
          systemPrompt,
          userPrompt,
          agentModel,
          agentThinking || false,
          lengthMaxTokens,
          agentId,
          streamUpdater.append
        );
        const completed = completeAttempt(filePath, attemptId, { status: "succeeded", modelSource: result.model });
        streamUpdater.finish(result.text, result.model);
        updateEvent(filePath, eventId, (event) => ({
          ...event,
          attemptId,
          phase: `roundtable-round-${round}`,
          durationMs: completed?.durationMs,
          provenance: eventProvenance(agentModel, result.model),
        }));
      } catch (err) {
        const completed = completeAttempt(filePath, attemptId, { status: "failed", error: err });
        const failure = eventFailureText("Failed to generate response", err);
        streamUpdater.fail(failure.text, {
          errorKind: failure.errorKind,
          durationMs: completed?.durationMs,
          attemptId,
          phase: `roundtable-round-${round}`,
        });
      }
      setThinkingAgent(filePath, null);

      await new Promise((r) => setTimeout(r, 500));
      const continueSession = await applyPacing(filePath, pacing);
      if (!continueSession) return;
    }

    // After first round: generate auto-title (fire-and-forget, non-blocking)
    if (round === 1) {
      const afterFirstRound = fs.readFileSync(filePath, "utf-8");
      const afterFirstSession = JSON.parse(afterFirstRound);
      const firstRoundEvents = (afterFirstSession.events || []).filter(
        (e: { type: string; text: string; speaker: string; role?: string }) =>
          e.type === "worker" || e.type === "supervisor" || e.role === "moderator"
      );
      generateSessionTitle(filePath, topic, firstRoundEvents, model).catch(console.warn);
    }

    // ── Moderator interjection between rounds ─────────────────────────────────
    if (moderatorId && AGENT_DEFS[moderatorId] && round < numRounds) {
      const interjectRaw = fs.readFileSync(filePath, "utf-8");
      const interjectSession = JSON.parse(interjectRaw);
      if (interjectSession.status !== "active") return;

      const interjectHistory = buildHistoryString(interjectSession.events || []);
      const modAgent = AGENT_DEFS[moderatorId];
      const modOverlay = getAgentOverlay(personaOverlays, moderatorId);
      const modSystemPrompt = buildModeratorSystemPrompt(
        moderatorId, topic, modOverlay, responseLength, thinking, referenceContext,
        agentPersonalityTraits?.[moderatorId],
        agentCommunicationStyles?.[moderatorId],
        agentIntensityLevels?.[moderatorId]
      );

      const interjectPrompt = `Topic: ${topic}\n\nDiscussion so far:\n\n${interjectHistory}\n\nRound ${round} of ${numRounds} is complete. As moderator, interject now to guide the next round:\n- Summarize the key points and areas of agreement/disagreement so far\n- Redirect if the discussion has drifted from the core topic\n- Surface any angles or perspectives that haven't been adequately explored\n- Set the agenda for the next round — what should participants focus on?\n\nKeep it tight. This is a transition, not a speech.`;

      let interjectText = "";
      let interjectModel = model;
      const interjectMaxTokens = RESPONSE_LENGTH_CONFIG[responseLength].maxTokens;
      const interjectAttemptId = beginAttempt(filePath, {
        phase: `moderator-interjection-${round}`,
        agentId: moderatorId,
        model,
      });
      let interjectDurationMs: number | undefined;
      let interjectErrorKind: string | undefined;
      let interjectError = false;
      setThinkingAgent(filePath, moderatorId);
      try {
        const result = await callAgent(modSystemPrompt, interjectPrompt, model, thinking, interjectMaxTokens, moderatorId);
        interjectText = result.text;
        interjectModel = result.model;
        interjectDurationMs = completeAttempt(filePath, interjectAttemptId, { status: "succeeded", modelSource: result.model })?.durationMs;
      } catch (err) {
        const completed = completeAttempt(filePath, interjectAttemptId, { status: "failed", error: err });
        const failure = eventFailureText("Failed to generate moderator interjection", err);
        interjectText = failure.text;
        interjectErrorKind = failure.errorKind;
        interjectDurationMs = completed?.durationMs;
        interjectError = true;
      }
      setThinkingAgent(filePath, null);

      appendEvent(filePath, {
        id: `evt_mod_interject_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        type: interjectError ? "error" : "worker",
        speaker: moderatorId,
        emoji: modAgent.emoji,
        role: "moderator" as const,
        text: interjectText,
        model: interjectModel,
        modelSource: interjectModel,
        provenance: eventProvenance(model, interjectError ? undefined : interjectModel),
        error: interjectError || undefined,
        errorKind: interjectErrorKind,
        durationMs: interjectDurationMs,
        attemptId: interjectAttemptId,
        phase: `moderator-interjection-${round}`,
      });

      await new Promise((r) => setTimeout(r, 500));
      const continueAfterInterject = await applyPacing(filePath, pacing);
      if (!continueAfterInterject) return;
    }
  }

  // For persistent sessions: stay active, don't auto-complete or auto-archive
  if (isPersistent) {
    // Just verify session is still active and leave it open
    const checkRaw = fs.readFileSync(filePath, "utf-8");
    const checkSession = JSON.parse(checkRaw);
    if (checkSession.status !== "active") return;
    // No completion — session waits for human directives or "Request Full Round"
    return;
  }

  // Non-persistent: wrap up with a summary — moderator delivers if present
  const summaryAgentId = moderatorId || (agents.includes("Henry") ? "Henry" : agents[0]);
  const finalRaw = fs.readFileSync(filePath, "utf-8");
  const finalSession = JSON.parse(finalRaw);
  if (finalSession.status !== "active") return;

  const finalHistory = buildHistoryString(finalSession.events || []);
  const summaryAgentOverlay = getAgentOverlay(personaOverlays, summaryAgentId);
  const summaryModelId = resolveModel(agentModelOverrides?.[summaryAgentId] || model).model;
  const summaryThinking = agentThinkingLevels?.[summaryAgentId] || (thinking ? "medium" : undefined);

  const finalSystemPrompt = moderatorId
    ? buildModeratorSystemPrompt(
        summaryAgentId, topic, summaryAgentOverlay, responseLength, thinking, referenceContext,
        agentPersonalityTraits?.[summaryAgentId],
        agentCommunicationStyles?.[summaryAgentId],
        agentIntensityLevels?.[summaryAgentId]
      )
    : buildSystemPrompt(
        summaryAgentId, "roundtable", topic, summaryAgentOverlay, responseLength, thinking, referenceContext,
        agentPersonalityTraits?.[summaryAgentId],
        agentCommunicationStyles?.[summaryAgentId],
        agentIntensityLevels?.[summaryAgentId]
      );
  const summaryPrompt = moderatorId
    ? `Topic: ${topic}\n\nFull discussion:\n\n${finalHistory}\n\nThe roundtable is now complete. As moderator, deliver your final synthesis and closing statement. Summarize the key conclusions, assign action items to specific participants with timelines, flag any unresolved questions, and tell the user what he should do next. Be direct and decisive — this is your authoritative wrap-up.`
    : `Topic: ${topic}\n\nFull discussion:\n\n${finalHistory}\n\nThe roundtable discussion is now complete. As ${summaryAgentId === "Henry" ? "Chief of Staff" : AGENT_DEFS[summaryAgentId]?.role || "session host"}, synthesize the key conclusions, decisions, and recommended next steps from this roundtable. Be direct and actionable.`;

  let summaryText = "";
  let summaryModel = summaryModelId;
  const summaryMaxTokens = RESPONSE_LENGTH_CONFIG[responseLength].maxTokens;
  const summaryAttemptId = beginAttempt(filePath, {
    phase: "roundtable-summary",
    agentId: summaryAgentId,
    model: summaryModelId,
  });
  let summaryDurationMs: number | undefined;
  let summaryErrorKind: string | undefined;
  let summaryError = false;
  try {
    const result = await callAgent(
      finalSystemPrompt,
      summaryPrompt,
      summaryModelId,
      summaryThinking || false,
      summaryMaxTokens,
      summaryAgentId
    );
    summaryText = result.text;
    summaryModel = result.model;
    summaryDurationMs = completeAttempt(filePath, summaryAttemptId, { status: "succeeded", modelSource: result.model })?.durationMs;
  } catch (err) {
    const completed = completeAttempt(filePath, summaryAttemptId, { status: "failed", error: err });
    const failure = eventFailureText("Could not generate summary", err);
    summaryText = failure.text;
    summaryErrorKind = failure.errorKind;
    summaryDurationMs = completed?.durationMs;
    summaryError = true;
  }

  const summaryAgent = AGENT_DEFS[summaryAgentId];
  const summaryEvent = {
    id: `evt_summary_${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: "complete",
    speaker: summaryAgentId,
    emoji: summaryAgent?.emoji || "🎉",
    role: moderatorId ? ("moderator" as const) : summaryAgentId === "Henry" ? "supervisor" : "worker",
    text: `**${moderatorId ? "Moderator's Final Synthesis" : "Session Summary"}**\n\n${summaryText}`,
    verdict: "approve",
    model: summaryModel,
    modelSource: summaryModel,
    provenance: eventProvenance(summaryModelId, summaryError ? undefined : summaryModel),
    error: summaryError || undefined,
    errorKind: summaryErrorKind,
    durationMs: summaryDurationMs,
    attemptId: summaryAttemptId,
    phase: "roundtable-summary",
  };
  appendEvent(filePath, summaryEvent);

  // Mark session as completed
  const completedRaw = fs.readFileSync(filePath, "utf-8");
  const completedSession = JSON.parse(completedRaw);
  completedSession.status = "completed";
  completedSession.completedAt = new Date().toISOString();
  completedSession.outcome = "roundtable-complete";
  completedSession.thinkingAgent = null;
  completedSession.runInProgress = false;
  fs.writeFileSync(filePath, JSON.stringify(completedSession, null, 2));
}

// ─── COMPETITIVE IDEATION mode ──────────────────────────────────────────────

async function runCompetitive(
  filePath: string,
  session: Record<string, unknown>,
  topic: string,
  agents: string[],
  personaOverlays: Record<string, string> | string[] | undefined,
  pacing: string = "instant",
  model: string = INFERENCE_MODEL,
  thinking = false,
  responseLength: ResponseLength = DEFAULT_RESPONSE_LENGTH,
  referenceContext?: string,
  agentPersonalityTraits?: Record<string, string[]>,
  agentCommunicationStyles?: Record<string, string>,
  agentIntensityLevels?: Record<string, number>,
  agentResponseLengths?: Record<string, string>,
  agentModelOverrides?: Record<string, string>,
  agentThinkingLevels?: Record<string, string>
) {
  const lengthMaxTokens = RESPONSE_LENGTH_CONFIG[responseLength].maxTokens;
  const competitiveVoteMode = session.competitiveVoteMode === "top-ideas" ? "top-ideas" : "agent-winner";
  const competitiveTopCount = Math.max(1, Math.min(10, Number(session.competitiveTopCount) || 3));
  const isTopIdeasVote = competitiveVoteMode === "top-ideas";

  // Helper: build competitive system prompt per phase
  function buildCompetitiveSystemPrompt(
    agentId: string,
    phase: "pitch" | "critique" | "vote",
    pitches: Record<string, string>,
    agentLength: ResponseLength = responseLength
  ): string {
    const agent = getSessionAgentIdentity(session, agentId);

    const agentOverlay = getAgentOverlay(personaOverlays, agentId);
    const overlayContent = agentOverlay ? PERSONA_CONTENT[agentOverlay] : null;
    const overlayLine = overlayContent ? `\nSpecialized lens: ${overlayContent}\n` : "";
    const memoryEntries = getAgentMemory(agentId, 3);
    const memoryBlock = formatMemoryForPrompt(memoryEntries);
    const referenceBlock = referenceContext ? `\n**Reference material:**\n${referenceContext}\n` : "";
    const personalityBlock = buildPersonalityBlock(
      agentPersonalityTraits?.[agentId] || [],
      agentCommunicationStyles?.[agentId],
      agentIntensityLevels?.[agentId]
    );

    const baseIdentity = `${agent.persona}\n\n---\n\nYou are ${agent.name} ${agent.emoji}, the ${agent.role} at Panely.\n${overlayLine}${memoryBlock}${referenceBlock}${personalityBlock}`;

    if (phase === "pitch" && isTopIdeasVote) {
      return `${baseIdentity}

**MODE: COMPETITIVE IDEATION — ROUND 1: TOP-THREE IMPROVEMENT PITCH**

You are competing against other agents to propose the strongest improvements to the advisory-board skill in the source material.

**Rules:**
- Pitch exactly THREE specific improvement ideas.
- Give each idea a short, memorable title.
- Each idea should be independently votable in Round 3.
- Avoid vague categories like "better docs." Name concrete changes that could be built.
- Ground your ideas in your unique expertise as ${agent.role}.
- For each idea, include: what changes, why it matters, implementation shape, and what risk it reduces.
- You are trying to get individual ideas into the final top three, not trying to win as an agent.

**Format:**
IDEA 1: [short title]
[analysis]

IDEA 2: [short title]
[analysis]

IDEA 3: [short title]
[analysis]

**Response length:** ${RESPONSE_LENGTH_CONFIG[agentLength].instruction}

Think like a product-minded skill architect. The best improvements should make the skill more reliable, easier to use, more reproducible, or more valuable in real Panely runs.`;
    }

    if (phase === "pitch") {
      return `${baseIdentity}

**MODE: COMPETITIVE IDEATION — ROUND 1: PITCH**

You are competing against other agents to pitch the BEST idea on the topic below. This is a competition — not a collaboration. You want to WIN.

**Rules:**
- Pitch ONE bold, specific, original idea. Not a list of ideas. ONE killer concept.
- Be provocative. Safe ideas lose. The bolder and more differentiated your pitch, the better.
- Ground it in your unique expertise as ${agent.role} — why are YOU the right person for this idea?
- Include a concrete execution plan: what gets built, by whom, by when.
- Name your pitch with a catchy title.
- You are trying to convince the other agents to vote for YOUR idea in Round 3.

**Response length:** ${RESPONSE_LENGTH_CONFIG[agentLength].instruction}

Think like a founder pitching to VCs who've seen 1000 pitches today. Stand out or go home.`;
    }

    if (phase === "critique") {
      const pitchSummary = Object.entries(pitches)
        .map(([name, pitch]) => `═══ ${name.toUpperCase()}'S PITCH ═══\n${pitch}`)
        .join("\n\n---\n\n");

      return `${baseIdentity}

**MODE: COMPETITIVE IDEATION — ROUND 2: CRITIQUE**

You've heard all the pitches. Now tear them apart. Your job is to find weaknesses, challenge assumptions, and stress-test every idea — INCLUDING YOUR OWN if it deserves it.

**The pitches:**

${pitchSummary}

**Rules:**
- You MUST reference each competitor BY NAME (e.g., "Atlas's pitch assumes..." or "The weakness in Scout's proposal is...")
- ${isTopIdeasVote ? `Focus on the individual improvement ideas. Identify which specific ideas deserve top-three consideration and which should be discarded or merged.` : "Focus on the strongest and weakest pitches."}
- Attack the idea, not the person. Be intellectually rigorous, not petty.
- Identify fatal flaws, missing risks, unrealistic assumptions, execution gaps
- You may defend your own pitch against anticipated criticism — but be honest about its weaknesses too
- Suggest what would make a competing pitch stronger if you see potential in it
- Be direct and unsparing. Politeness is fine but pulling punches is not.

**Response length:** ${RESPONSE_LENGTH_CONFIG[agentLength].instruction}

This is the crucible. The best ideas survive tough criticism. Do your job.`;
    }

    // Vote phase
    const pitchSummary = Object.entries(pitches)
      .map(([name, pitch]) => `═══ ${name.toUpperCase()}'S PITCH ═══\n${pitch}`)
      .join("\n\n---\n\n");

    if (isTopIdeasVote) {
      return `${baseIdentity}

**MODE: COMPETITIVE IDEATION — ROUND 3: TOP-THREE IDEA VOTE**

The pitches have been made. The critiques have been heard. Now vote on the top ${competitiveTopCount} individual improvement ideas overall.

**The pitches:**

${pitchSummary}

**Rules:**
- You MUST vote for exactly ${competitiveTopCount} individual ideas, not agents.
- Use the idea title as written by the pitching agent whenever possible.
- You may vote for your own idea only if it genuinely belongs in the top ${competitiveTopCount}; do not pad your own slate.
- Consider: impact on the skill, implementation clarity, reliability, reproducibility, safety, and usefulness in Panely.
- Format your vote EXACTLY like this at the top:
**VOTE 1: [Idea Title]**
**VOTE 2: [Idea Title]**
**VOTE 3: [Idea Title]**
- Then explain the ranking in 3-5 concise sentences.

**Response length:** Concise. Three votes plus short reasoning.`;
    }

    return `${baseIdentity}

**MODE: COMPETITIVE IDEATION — ROUND 3: VOTE**

The pitches have been made. The critiques have been heard. Now VOTE.

**The pitches:**

${pitchSummary}

**Rules:**
- You MUST vote for exactly ONE idea. You CANNOT vote for your own pitch.
- Format your vote EXACTLY like this on the first line: **VOTE: [Agent Name]**
- Then explain your reasoning in 2-3 sentences. Why this idea? What convinced you?
- Consider: originality, feasibility, impact, how well the idea survived critique
- Be honest. Vote for the idea that's genuinely best for the company, not for your friend.

**Response length:** Concise. Vote + 2-3 sentences of reasoning. That's it.`;
  }

  // ─── ROUND 1: PITCH ───────────────────────────────────────────────────────

  // Update phase
  const updatePhase = (phase: string) => {
    const raw = fs.readFileSync(filePath, "utf-8");
    const s = JSON.parse(raw);
    if (!s.competitive) s.competitive = { phase, voteMode: competitiveVoteMode, topCount: competitiveTopCount, pitches: {}, votes: [], winner: null, voteTally: {} };
    s.competitive.phase = phase;
    s.competitive.voteMode = competitiveVoteMode;
    s.competitive.topCount = competitiveTopCount;
    fs.writeFileSync(filePath, JSON.stringify(s, null, 2));
  };

  updatePhase("pitch");

  // Add round marker
  appendEvent(filePath, {
    id: `evt_round1_${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: "start",
    speaker: "System",
    emoji: "🎯",
    role: "supervisor",
    text: isTopIdeasVote
      ? "**⚔️ Round 1 — TOP-THREE IMPROVEMENT PITCH**\nEach agent proposes three concrete improvements. Ideas will be voted on individually."
      : "**⚔️ Round 1 — PITCH**\nEach agent pitches their boldest idea. One idea. Make it count.",
  });

  const pitches: Record<string, string> = {};

  for (const agentId of agents) {
    const checkRaw = fs.readFileSync(filePath, "utf-8");
    const checkSession = JSON.parse(checkRaw);
    if (checkSession.status !== "active") return;

    const agentLength = (agentResponseLengths?.[agentId] as ResponseLength | undefined) || responseLength;
    const agentModel = resolveModel(agentModelOverrides?.[agentId] || model).model;
    const agentThinking = agentThinkingLevels?.[agentId] || (thinking ? "medium" : undefined);
    const systemPrompt = buildCompetitiveSystemPrompt(agentId, "pitch", {}, agentLength);
    const userPrompt = `Topic: ${topic}\n\nYou are first up (or responding after hearing others). Pitch your idea NOW.`;

    setThinkingAgent(filePath, agentId);
    let text = "";
    let spawnedModel = agentModel;
    let failed = false;
    let errorKind: string | undefined;
    let durationMs: number | undefined;
    const attemptId = beginAttempt(filePath, {
      phase: "competitive-pitch",
      agentId,
      model: agentModel,
    });
    try {
      const result = await callAgent(systemPrompt, userPrompt, agentModel, agentThinking || false, RESPONSE_LENGTH_CONFIG[agentLength].maxTokens, agentId);
      text = result.text;
      spawnedModel = result.model;
      durationMs = completeAttempt(filePath, attemptId, { status: "succeeded", modelSource: result.model })?.durationMs;
    } catch (err) {
      const completed = completeAttempt(filePath, attemptId, { status: "failed", error: err });
      const failure = eventFailureText("Failed to generate pitch", err);
      text = failure.text;
      errorKind = failure.errorKind;
      durationMs = completed?.durationMs;
      failed = true;
    }
    setThinkingAgent(filePath, null);

    if (!failed) pitches[agentId] = text;

    const agent = getSessionAgentIdentity(session, agentId);
    appendEvent(filePath, {
      id: `evt_pitch_${agentId}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: failed ? "error" : "worker",
      speaker: agentId,
      emoji: agent.emoji,
      role: "worker",
      text,
      model: spawnedModel,
      modelSource: spawnedModel,
      provenance: eventProvenance(agentModel, failed ? undefined : spawnedModel),
      error: failed || undefined,
      errorKind,
      durationMs,
      attemptId,
      phase: "competitive-pitch",
    });

    if (!failed) {
      // Store pitch in session state
      const pitchRaw = fs.readFileSync(filePath, "utf-8");
      const pitchSession = JSON.parse(pitchRaw);
      if (!pitchSession.competitive) pitchSession.competitive = { phase: "pitch", voteMode: competitiveVoteMode, topCount: competitiveTopCount, pitches: {}, votes: [], winner: null, voteTally: {} };
      pitchSession.competitive.pitches[agentId] = text;
      fs.writeFileSync(filePath, JSON.stringify(pitchSession, null, 2));
    }

    await new Promise((r) => setTimeout(r, 500));
    const continueSession = await applyPacing(filePath, pacing);
    if (!continueSession) return;
  }

  // Auto-title after pitches
  const afterPitches = fs.readFileSync(filePath, "utf-8");
  const afterPitchSession = JSON.parse(afterPitches);
  const pitchEvents = (afterPitchSession.events || []).filter(
    (e: { type: string }) => e.type === "worker"
  );
  generateSessionTitle(filePath, topic, pitchEvents, model).catch(console.warn);

  // ─── ROUND 2: CRITIQUE ────────────────────────────────────────────────────

  updatePhase("critique");

  appendEvent(filePath, {
    id: `evt_round2_${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: "start",
    speaker: "System",
    emoji: "🔥",
    role: "supervisor",
    text: "**🔥 Round 2 — CRITIQUE**\nGloves off. Find the flaws. Reference each pitch by name.",
  });

  for (const agentId of agents) {
    const checkRaw = fs.readFileSync(filePath, "utf-8");
    const checkSession = JSON.parse(checkRaw);
    if (checkSession.status !== "active") return;

    const currentEvents = (checkSession.events || []) as Array<{ id?: string; speaker: string; text: string; type: string }>;
    const history = buildHistoryString(currentEvents);
    const agentLength = (agentResponseLengths?.[agentId] as ResponseLength | undefined) || responseLength;
    const agentModel = resolveModel(agentModelOverrides?.[agentId] || model).model;
    const agentThinking = agentThinkingLevels?.[agentId] || (thinking ? "medium" : undefined);
    const systemPrompt = buildCompetitiveSystemPrompt(agentId, "critique", pitches, agentLength);
    const userPrompt = `Topic: ${topic}\n\nFull discussion so far:\n\n${history}\n\nNow critique all the pitches. Be rigorous and reference each competitor by name.`;

    setThinkingAgent(filePath, agentId);
    let text = "";
    let spawnedModel = agentModel;
    let failed = false;
    let errorKind: string | undefined;
    let durationMs: number | undefined;
    const attemptId = beginAttempt(filePath, {
      phase: "competitive-critique",
      agentId,
      model: agentModel,
    });
    try {
      const result = await callAgent(systemPrompt, userPrompt, agentModel, agentThinking || false, RESPONSE_LENGTH_CONFIG[agentLength].maxTokens, agentId);
      text = result.text;
      spawnedModel = result.model;
      durationMs = completeAttempt(filePath, attemptId, { status: "succeeded", modelSource: result.model })?.durationMs;
    } catch (err) {
      const completed = completeAttempt(filePath, attemptId, { status: "failed", error: err });
      const failure = eventFailureText("Failed to generate critique", err);
      text = failure.text;
      errorKind = failure.errorKind;
      durationMs = completed?.durationMs;
      failed = true;
    }
    setThinkingAgent(filePath, null);

    const agent = getSessionAgentIdentity(session, agentId);
    appendEvent(filePath, {
      id: `evt_critique_${agentId}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: failed ? "error" : "reviewer",
      speaker: agentId,
      emoji: agent.emoji,
      role: "reviewer",
      text,
      model: spawnedModel,
      modelSource: spawnedModel,
      provenance: eventProvenance(agentModel, failed ? undefined : spawnedModel),
      error: failed || undefined,
      errorKind,
      durationMs,
      attemptId,
      phase: "competitive-critique",
    });

    await new Promise((r) => setTimeout(r, 500));
    const continueSession = await applyPacing(filePath, pacing);
    if (!continueSession) return;
  }

  // ─── ROUND 3: VOTE ────────────────────────────────────────────────────────

  updatePhase("vote");

  appendEvent(filePath, {
    id: `evt_round3_${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: "start",
    speaker: "System",
    emoji: "🗳️",
    role: "supervisor",
    text: isTopIdeasVote
      ? `**🗳️ Round 3 — TOP-${competitiveTopCount} IDEA VOTE**\nEach agent votes for the top ${competitiveTopCount} individual ideas overall. Format: **VOTE 1: [Idea Title]**`
      : "**🗳️ Round 3 — VOTE**\nEach agent votes for the best idea (not their own). Format: **VOTE: [Name]**",
  });

  const votes: Array<{ voter: string; votedFor: string; reasoning: string }> = [];
  const voteTally: Record<string, number> = {};
  if (!isTopIdeasVote) {
    for (const a of agents) voteTally[a] = 0;
  }

  for (const agentId of agents) {
    const checkRaw = fs.readFileSync(filePath, "utf-8");
    const checkSession = JSON.parse(checkRaw);
    if (checkSession.status !== "active") return;

    const currentEvents = (checkSession.events || []) as Array<{ id?: string; speaker: string; text: string; type: string }>;
    const blindVoteEvents = filterBlindVoteEvents(currentEvents);
    const history = buildHistoryString(blindVoteEvents);
    const agentModel = resolveModel(agentModelOverrides?.[agentId] || model).model;
    const agentThinking = agentThinkingLevels?.[agentId] || (thinking ? "medium" : undefined);
    const systemPrompt = buildCompetitiveSystemPrompt(agentId, "vote", pitches);
    const userPrompt = isTopIdeasVote
      ? `Topic: ${topic}\n\nFull discussion:\n\n${history}\n\nCast your top ${competitiveTopCount} idea votes now. Remember: **VOTE 1: [Idea Title]**, **VOTE 2: [Idea Title]**, **VOTE 3: [Idea Title]** at the top, then your reasoning.`
      : `Topic: ${topic}\n\nFull discussion:\n\n${history}\n\nCast your vote now. Remember: **VOTE: [Agent Name]** on the first line, then your reasoning.`;

    setThinkingAgent(filePath, agentId);
    let text = "";
    let spawnedModel = agentModel;
    let failed = false;
    let errorKind: string | undefined;
    let durationMs: number | undefined;
    const attemptId = beginAttempt(filePath, {
      phase: "competitive-vote",
      agentId,
      model: agentModel,
    });
    try {
      const result = await callAgent(systemPrompt, userPrompt, agentModel, agentThinking || false, 512, agentId);
      text = result.text;
      spawnedModel = result.model;
      durationMs = completeAttempt(filePath, attemptId, { status: "succeeded", modelSource: result.model })?.durationMs;
    } catch (err) {
      const completed = completeAttempt(filePath, attemptId, { status: "failed", error: err });
      const failure = eventFailureText("Failed to generate vote", err);
      text = failure.text;
      errorKind = failure.errorKind;
      durationMs = completed?.durationMs;
      failed = true;
    }
    setThinkingAgent(filePath, null);

    // Parse the vote
    const topIdeaVotes = !failed && isTopIdeasVote ? parseTopIdeaVotes(text, competitiveTopCount) : [];
    const votedFor = failed ? "Provider failed" : isTopIdeasVote ? (topIdeaVotes.join("; ") || "Unknown") : parseCompetitiveVote(text, agentId, agents);
    if (!failed && isTopIdeasVote) {
      const normalizedVotes: string[] = [];
      for (const idea of topIdeaVotes) {
        const tallyLabel = registerTopIdeaVote(voteTally, idea);
        if (tallyLabel) normalizedVotes.push(tallyLabel);
      }
      votes.push({ voter: agentId, votedFor: normalizedVotes.join("; ") || votedFor, reasoning: text });
    } else if (!failed && votedFor !== "Unknown" && voteTally[votedFor] !== undefined) {
      voteTally[votedFor]++;
      votes.push({ voter: agentId, votedFor, reasoning: text });
    } else {
      votes.push({ voter: agentId, votedFor, reasoning: text });
    }

    const agent = getSessionAgentIdentity(session, agentId);
    appendEvent(filePath, {
      id: `evt_vote_${agentId}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: failed ? "error" : "worker",
      speaker: agentId,
      emoji: agent.emoji || "🗳️",
      role: "worker",
      text,
      verdict: "approve",
      model: spawnedModel,
      modelSource: spawnedModel,
      provenance: eventProvenance(agentModel, failed ? undefined : spawnedModel),
      error: failed || undefined,
      errorKind,
      durationMs,
      attemptId,
      phase: "competitive-vote",
    });

    await new Promise((r) => setTimeout(r, 300));
  }

  // ─── FINAL: TALLY & DECLARE WINNER ──────────────────────────────────────

  updatePhase("complete");

  // Determine winner
  const winner = selectWinner(voteTally, agents[0]);
  const topIdeas = buildTopIdeasFromTally(voteTally, competitiveTopCount)
    .map(({ idea, votes: voteCount }) => ({ idea, votes: voteCount }));

  // Store final competitive state
  const finalStateRaw = fs.readFileSync(filePath, "utf-8");
  const finalStateSession = JSON.parse(finalStateRaw);
  finalStateSession.competitive = {
    phase: "complete",
    voteMode: competitiveVoteMode,
    topCount: competitiveTopCount,
    pitches,
    votes,
    winner,
    voteTally,
    topIdeas,
  };
  fs.writeFileSync(filePath, JSON.stringify(finalStateSession, null, 2));

  // Build vote results summary
  const tallyLines = Object.entries(voteTally)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => {
      const rank = topIdeas.findIndex((idea) => idea.idea === name);
      const isWinner = name === winner;
      const marker = isTopIdeasVote && rank >= 0 ? `#${rank + 1}` : isWinner ? "🏆" : "　";
      const suffix = isTopIdeasVote && rank >= 0 ? ` ← TOP ${rank + 1}` : isWinner ? " ← WINNER" : "";
      return `${marker} **${name}** — ${count} vote${count !== 1 ? "s" : ""}${suffix}`;
    });

  const voteDetails = votes
    .map((v) => `- **${v.voter}** voted for **${v.votedFor}**`)
    .join("\n");

  // Generate action items from the winning pitch
  const summarySystemPrompt = `You are Henry ⚡, Chief of Staff at Panely. A competitive ideation session just concluded.

${isTopIdeasVote ? `The agents voted on the top ${competitiveTopCount} individual ideas overall. The top ideas are:
${topIdeas.map((idea, index) => `${index + 1}. ${idea.idea} (${idea.votes} vote${idea.votes !== 1 ? "s" : ""})`).join("\n")}` : `The winning idea was pitched by ${winner}.`}

Your job is to:
1. ${isTopIdeasVote ? `Declare the top ${competitiveTopCount} ideas and summarize why they won` : "Declare the winner and summarize why they won"}
2. Synthesize the best elements from ALL pitches
3. Extract 3-5 concrete action items with owners and timelines
4. Note any risks or open questions that came up during critique

Be direct and actionable. This becomes the marching orders.`;

  const summaryUserPrompt = `Topic: ${topic}

**Vote Results:**
${tallyLines.join("\n")}

**Vote Details:**
${voteDetails}

${isTopIdeasVote ? `**Top Ideas:**
${topIdeas.map((idea, index) => `${index + 1}. ${idea.idea} — ${idea.votes} vote${idea.votes !== 1 ? "s" : ""}`).join("\n")}` : `**Winning Pitch (${winner}):**
${pitches[winner] || "N/A"}`}

**All Pitches:**
${Object.entries(pitches).map(([name, pitch]) => `[${name}]: ${pitch.slice(0, 500)}`).join("\n\n")}

Deliver the final verdict and action plan.`;

  let summaryText = "";
  const summaryModelId = resolveModel(agentModelOverrides?.Henry || model).model;
  const summaryThinking = agentThinkingLevels?.Henry || (thinking ? "medium" : undefined);
  let summaryModel = summaryModelId;
  const summaryAttemptId = beginAttempt(filePath, {
    phase: "competitive-summary",
    agentId: "Henry",
    model: summaryModelId,
  });
  let summaryDurationMs: number | undefined;
  let summaryErrorKind: string | undefined;
  let summaryError = false;
  setThinkingAgent(filePath, "Henry");
  try {
    const result = await callAgent(summarySystemPrompt, summaryUserPrompt, summaryModelId, summaryThinking || false, lengthMaxTokens, "Henry");
    summaryText = result.text;
    summaryModel = result.model;
    summaryDurationMs = completeAttempt(filePath, summaryAttemptId, { status: "succeeded", modelSource: result.model })?.durationMs;
  } catch (err) {
    const completed = completeAttempt(filePath, summaryAttemptId, { status: "failed", error: err });
    const failure = eventFailureText("Could not generate summary", err);
    summaryText = failure.text;
    summaryErrorKind = failure.errorKind;
    summaryDurationMs = completed?.durationMs;
    summaryError = true;
  }
  setThinkingAgent(filePath, null);

  // Append results event
  appendEvent(filePath, {
    id: `evt_results_${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: "complete",
    speaker: "Henry",
    emoji: "🏆",
    role: "supervisor",
    text: `${isTopIdeasVote ? `**🏆 Top ${competitiveTopCount} Idea Results**` : "**🏆 Competition Results**"}\n\n${tallyLines.join("\n")}\n\n---\n\n${summaryText}`,
    verdict: "approve",
    model: summaryModel,
    modelSource: summaryModel,
    provenance: eventProvenance(summaryModelId, summaryError ? undefined : summaryModel),
    error: summaryError || undefined,
    errorKind: summaryErrorKind,
    durationMs: summaryDurationMs,
    attemptId: summaryAttemptId,
    phase: "competitive-summary",
  });

  // Mark session complete
  const completedRaw = fs.readFileSync(filePath, "utf-8");
  const completedSession = JSON.parse(completedRaw);
  completedSession.status = "completed";
  completedSession.completedAt = new Date().toISOString();
  completedSession.outcome = "competitive-complete";
  completedSession.thinkingAgent = null;
  completedSession.runInProgress = false;
  completedSession.competitive = { phase: "complete", voteMode: competitiveVoteMode, topCount: competitiveTopCount, pitches, votes, winner, voteTally, topIdeas };
  fs.writeFileSync(filePath, JSON.stringify(completedSession, null, 2));
}
