import {
  TrendingUp,
  Rocket,
  Shield,
  Cpu,
  Megaphone,
  Settings,
} from "lucide-react";
import type {
  AgentDef,
  PersonaOverlay,
  ModelOption,
  PacingOption,
  SessionTemplate,
  AdvisoryEvent,
  AdvisorySession,
} from "@/types/advisory";
import { getAgentByAnyId } from "@/config/agents";
import { PROVIDERS } from "@/lib/ai/providers";

// ─── Agent Definitions ───────────────────────────────────────────────────────

export const AGENTS: AgentDef[] = [
  { id: "Henry", emoji: "⚡", role: "Chief of Staff", defaultRole: "supervisor" },
  { id: "Atlas", emoji: "📈", role: "Stocks & Options Trader", defaultRole: "worker" },
  { id: "Nimbus", emoji: "🌤️", role: "Weather Prediction Trader", defaultRole: "worker" },
  { id: "Cipher", emoji: "₿", role: "Crypto Trader", defaultRole: "worker" },
  { id: "Quant", emoji: "📊", role: "Trading Strategy Architect", defaultRole: "worker" },
  { id: "Forge", emoji: "🔧", role: "Backend Engineer", defaultRole: "worker" },
  { id: "Pixel", emoji: "💻", role: "Senior Full-Stack Engineer", defaultRole: "worker" },
  { id: "Scout", emoji: "🔭", role: "Research & Intelligence", defaultRole: "worker" },
  { id: "Quill", emoji: "✍️", role: "Creative Writer & Marketing", defaultRole: "worker" },
  { id: "Counsel", emoji: "⚖️", role: "Legal Expert", defaultRole: "reviewer" },
];

// ─── Persona Overlays ────────────────────────────────────────────────────────

export const PERSONA_OVERLAYS: PersonaOverlay[] = [
  { id: "trading-strategist", name: "Trading Strategist", emoji: "📊", desc: "Deep quant analysis: momentum, mean-reversion, risk-reward optimization", relevantAgents: ["Atlas", "Nimbus", "Cipher", "Quant", "Henry"] },
  { id: "seo-specialist", name: "SEO Specialist", emoji: "🔍", desc: "Keyword research, on-page optimization, SERP strategy, content gap analysis", relevantAgents: ["Quill", "Scout"] },
  { id: "growth-hacker", name: "Growth Hacker", emoji: "🚀", desc: "Viral loops, acquisition funnels, retention mechanics, rapid experimentation", relevantAgents: ["Quill", "Scout", "Henry"] },
  { id: "content-creator", name: "Content Creator", emoji: "✍️", desc: "Audience-first storytelling, platform-native formats, engagement optimization", relevantAgents: ["Quill"] },
  { id: "compliance-auditor", name: "Compliance Auditor", emoji: "⚖️", desc: "Regulatory risk review, audit trails, policy adherence, legal exposure analysis", relevantAgents: ["Counsel", "Henry"] },
  { id: "security-engineer", name: "Security Engineer", emoji: "🔐", desc: "Threat modeling, vulnerability assessment, secure design review, auth hardening", relevantAgents: ["Forge", "Pixel"] },
  { id: "devops-automator", name: "DevOps Automator", emoji: "⚙️", desc: "CI/CD pipelines, infra-as-code, monitoring, incident response playbooks", relevantAgents: ["Forge"] },
  { id: "reality-checker", name: "Reality Checker", emoji: "🎯", desc: "Cuts through hype, stress-tests assumptions, identifies blind spots and risks", relevantAgents: ["Henry", "Scout", "Counsel"] },
  { id: "trend-researcher", name: "Trend Researcher", emoji: "📡", desc: "Emerging signals, market timing, early-mover opportunities, competitive intelligence", relevantAgents: ["Scout", "Quant"] },
  { id: "data-analytics-reporter", name: "Data Analytics Reporter", emoji: "📈", desc: "Structured data analysis, metrics framing, visual storytelling with numbers", relevantAgents: ["Scout", "Quant", "Atlas"] },
  { id: "backend-architect", name: "Backend Architect", emoji: "🏗️", desc: "System design, API contracts, scalability patterns, database schema review", relevantAgents: ["Forge", "Pixel"] },
];

export const PERSONA_OVERLAYS_EXTENDED: PersonaOverlay[] = [
  ...PERSONA_OVERLAYS,
  { id: "frontend-developer", name: "Frontend Developer", emoji: "🎨", desc: "Component architecture, state management, accessibility, performance optimization", relevantAgents: ["Pixel", "Forge"] },
  { id: "rapid-prototyper", name: "Rapid Prototyper", emoji: "⚡", desc: "Fastest path to working demo, cut for v1, validate before building", relevantAgents: ["Pixel"] },
  { id: "autonomous-optimization-architect", name: "Autonomous Optimization Architect", emoji: "🤖", desc: "AI agents replacing manual work, feedback loops, self-improving systems", relevantAgents: ["Henry"] },
];

export const AGENT_RECOMMENDED_OVERLAYS: Record<string, string[]> = {
  Atlas: ["trading-strategist", "data-analytics-reporter"],
  Nimbus: ["trading-strategist", "data-analytics-reporter"],
  Cipher: ["trading-strategist", "data-analytics-reporter"],
  Quant: ["trading-strategist", "data-analytics-reporter"],
  Forge: ["security-engineer", "devops-automator", "backend-architect"],
  Pixel: ["frontend-developer", "rapid-prototyper"],
  Scout: ["trend-researcher", "data-analytics-reporter"],
  Quill: ["seo-specialist", "growth-hacker", "content-creator"],
  Counsel: ["compliance-auditor"],
  Henry: ["autonomous-optimization-architect"],
};

// ─── Models ──────────────────────────────────────────────────────────────────

export const MODELS: ModelOption[] = [
  ...PROVIDERS.map((provider) => ({
    id: provider.id,
    label: provider.name,
    desc: provider.intent ?? "Available model provider.",
  })),
];

// ─── Pacing ──────────────────────────────────────────────────────────────────

export const PACING_OPTIONS: PacingOption[] = [
  { id: "instant", label: "Instant", desc: "Agents respond as fast as possible" },
  { id: "relaxed", label: "Relaxed (5s)", desc: "5 second pause between turns" },
  { id: "slow", label: "Slow (15s)", desc: "15 second pause between turns" },
  { id: "manual", label: "Manual (step-through)", desc: "Pauses after each turn — you advance manually" },
];

// ─── Session Templates ───────────────────────────────────────────────────────

export const SESSION_TEMPLATES: SessionTemplate[] = [
  {
    id: "trading-strategy",
    label: "Trading Strategy Review",
    desc: "Deep-dive into trading strategies with quant rigor",
    icon: TrendingUp,
    mode: "roundtable",
    agents: ["Henry", "Atlas", "Quant", "Cipher"],
    responseLength: "detailed",
    rounds: 3,
    topic: "Review and critique the proposed trading strategy, focusing on risk-adjusted returns, edge sustainability, and portfolio fit.",
  },
  {
    id: "product-launch",
    label: "Product Launch Planning",
    desc: "Cross-functional launch plan with marketing & engineering",
    icon: Rocket,
    mode: "roundtable",
    agents: ["Henry", "Pixel", "Scout", "Quill"],
    responseLength: "balanced",
    rounds: 3,
  },
  {
    id: "risk-legal",
    label: "Risk & Legal Assessment",
    desc: "Regulatory risk, compliance, and legal exposure review",
    icon: Shield,
    mode: "roundtable",
    agents: ["Henry", "Counsel", "Forge", "Scout"],
    responseLength: "detailed",
    rounds: 3,
  },
  {
    id: "tech-architecture",
    label: "Technical Architecture Review",
    desc: "System design, scalability, and engineering trade-offs",
    icon: Cpu,
    mode: "roundtable",
    agents: ["Henry", "Forge", "Pixel", "Quant"],
    responseLength: "detailed",
    rounds: 3,
  },
  {
    id: "marketing-growth",
    label: "Marketing & Growth Strategy",
    desc: "Growth levers, content strategy, and market positioning",
    icon: Megaphone,
    mode: "roundtable",
    agents: ["Henry", "Quill", "Scout", "Pixel"],
    responseLength: "balanced",
    rounds: 3,
  },
  {
    id: "competitive-ideation",
    label: "Competitive Ideation",
    desc: "Agents pitch competing ideas, debate, and vote on a winner",
    icon: Rocket,
    mode: "competitive",
    agents: ["Henry", "Scout", "Pixel", "Quill"],
    responseLength: "balanced",
    rounds: 3,
  },
  {
    id: "custom",
    label: "Custom",
    desc: "Blank slate — configure everything yourself",
    icon: Settings,
    mode: "roundtable",
    agents: ["Henry"],
    responseLength: "balanced",
    rounds: 3,
  },
];

export const DIVISIONS = ["Leadership", "Trading", "Engineering", "Research", "Creative", "Legal", "Custom"] as const;

// ─── Helper Functions ────────────────────────────────────────────────────────

export function getAgentRole(agentId: string): string {
  const builtIn = AGENTS.find((a) => a.id === agentId)?.role;
  if (builtIn) return builtIn;
  // Check custom agents in localStorage
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("advisory-custom-agents");
      if (stored) {
        const customs = JSON.parse(stored) as Array<{ name: string; role: string }>;
        const match = customs.find((a) => a.name === agentId);
        if (match?.role) return match.role;
      }
    } catch {}
  }
  return "Agent";
}

export function getOverlayName(overlayId: string): string {
  return (
    PERSONA_OVERLAYS_EXTENDED.find((o) => o.id === overlayId)?.name ?? overlayId
  );
}

export function getOverlayEmoji(overlayId: string): string {
  return (
    PERSONA_OVERLAYS_EXTENDED.find((o) => o.id === overlayId)?.emoji ?? "🎭"
  );
}

export function getOverlayDesc(overlayId: string): string {
  return (
    PERSONA_OVERLAYS_EXTENDED.find((o) => o.id === overlayId)?.desc ?? ""
  );
}

export function getEventStyle(event: AdvisoryEvent): { bg: string; border: string; badge: string } {
  const type = event.type;
  const role = event.role;

  if (type === "error" || event.error) {
    return { bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.4)", badge: "#ef4444" };
  }
  if (event.speaker === "the user" || type === "human-directive") {
    return { bg: "rgba(251, 191, 36, 0.06)", border: "rgba(251, 191, 36, 0.25)", badge: "#fbbf24" };
  }
  if (type === "start") return { bg: "rgba(139, 92, 246, 0.08)", border: "rgba(139, 92, 246, 0.3)", badge: "#8b5cf6" };
  if (type === "complete") return { bg: "rgba(74, 222, 128, 0.08)", border: "rgba(74, 222, 128, 0.3)", badge: "#4ade80" };
  if (type === "approve" || event.verdict === "approve") return { bg: "rgba(74, 222, 128, 0.06)", border: "rgba(74, 222, 128, 0.25)", badge: "#4ade80" };
  if (type === "reject" || event.verdict === "reject") return { bg: "rgba(239, 68, 68, 0.06)", border: "rgba(239, 68, 68, 0.25)", badge: "#ef4444" };
  if (role === "moderator") return { bg: "rgba(168, 85, 247, 0.08)", border: "rgba(168, 85, 247, 0.3)", badge: "#a855f7" };
  if (role === "supervisor") return { bg: "rgba(251, 146, 60, 0.06)", border: "rgba(251, 146, 60, 0.2)", badge: "#fb923c" };
  if (role === "reviewer") return { bg: "rgba(96, 165, 250, 0.06)", border: "rgba(96, 165, 250, 0.2)", badge: "#60a5fa" };
  return { bg: "rgba(100, 116, 139, 0.05)", border: "rgba(100, 116, 139, 0.15)", badge: "#94a3b8" };
}

export function getEventIcon(type: string, verdict?: string): string {
  if (type === "start") return "🚀";
  if (type === "complete") return "🎉";
  if (type === "approve" || verdict === "approve") return "🟢";
  if (type === "reject" || verdict === "reject") return "🔴";
  if (type === "supervisor") return "🟠";
  if (type === "worker") return "🔵";
  if (type === "reviewer") return "🟡";
  return "💬";
}

export function getRoleBadge(role: string, type?: string, speaker?: string): { label: string; color: string } {
  if (speaker === "the user") return { label: "HUMAN", color: "#fbbf24" };
  if (type === "start" || type === "complete") return { label: "SYSTEM", color: "#8b5cf6" };
  if (role === "moderator") return { label: "MODERATOR", color: "#a855f7" };
  if (role === "supervisor") return { label: "SUPERVISOR", color: "#fb923c" };
  if (role === "reviewer") return { label: "REVIEWER", color: "#60a5fa" };
  return { label: "WORKER", color: "#94a3b8" };
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatModelName(model?: string): string {
  if (!model) return "";
  const providerModel = PROVIDERS.find((m) => m.id === model || m.model === model || m.routedModel === model);
  if (providerModel) return providerModel.name;
  return model;
}

export function getStatusBadge(status: string): { label: string; color: string; bg: string } {
  if (status === "active") return { label: "LIVE", color: "#4ade80", bg: "rgba(74,222,128,0.12)" };
  if (status === "completed") return { label: "DONE", color: "#94a3b8", bg: "rgba(148,163,184,0.1)" };
  return { label: "ABANDONED", color: "#ef4444", bg: "rgba(239,68,68,0.1)" };
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function formatMarkdownExport(session: AdvisorySession, events: AdvisoryEvent[]): string {
  const topic = session.topic;
  const mode = session.mode;
  const dateStr = new Date(session.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const rawOverlays = (session as unknown as Record<string, unknown>).personaOverlays;
  const overlaysObj: Record<string, string> = Array.isArray(rawOverlays)
    ? {}
    : (rawOverlays as Record<string, string>) ?? {};

  const participantLines: string[] = [];
  for (const agentDisplayName of session.agents) {
    const agentConfig = getAgentByAnyId(agentDisplayName);
    const role = agentConfig?.role ?? getAgentRole(agentDisplayName);
    const emoji = agentConfig?.emoji ?? "🤖";
    const agentOverlayId = overlaysObj[agentDisplayName];
    const agentOverlayStr = agentOverlayId
      ? ` [${getOverlayEmoji(agentOverlayId)} ${getOverlayName(agentOverlayId)}]`
      : "";
    participantLines.push(`  ${emoji} ${agentDisplayName} — ${role}${agentOverlayStr}`);
  }

  const allEvents = events as (AdvisoryEvent & { model?: string })[];
  const modelsUsed = [...new Set(allEvents.map((e) => e.model).filter(Boolean))];
  const modelsStr = modelsUsed.length > 0 ? modelsUsed.join(", ") : "N/A";
  const responseLengthStr = (session as unknown as Record<string, unknown>).responseLength as string ?? "balanced";

  const lines: string[] = [
    `════════════════════════════════════════════════════════════`,
    `  HARRIS AUTONOMOUS — ADVISORY BOARD`,
    `════════════════════════════════════════════════════════════`,
    ``,
    `  Topic:    ${topic}`,
    `  Date:     ${dateStr}`,
    `  Mode:     ${mode.charAt(0).toUpperCase() + mode.slice(1)}`,
    `  Length:   ${responseLengthStr.charAt(0).toUpperCase() + responseLengthStr.slice(1)}`,
    `  Model(s): ${modelsStr}`,
    ``,
    `────────────────────────────────────────────────────────────`,
    `  PARTICIPANTS`,
    `────────────────────────────────────────────────────────────`,
    ``,
    ...participantLines,
    ``,
    `════════════════════════════════════════════════════════════`,
    ``,
  ];

  for (const event of events) {
    if (!event.text || !event.speaker) continue;
    if (event.type === "start") continue;
    const agentConfig = getAgentByAnyId(event.speaker);
    const role = agentConfig?.role ?? getAgentRole(event.speaker);
    const emoji = agentConfig?.emoji ?? event.emoji ?? "";
    const speakerOverlayId = overlaysObj[event.speaker];
    const overlayStr = speakerOverlayId
      ? ` [${getOverlayEmoji(speakerOverlayId)} ${getOverlayName(speakerOverlayId)}]`
      : "";
    const timeStr = new Date(event.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    lines.push(`────────────────────────────────────────────────────────────`);
    lines.push(`${emoji} ${event.speaker.toUpperCase()} — ${role}${overlayStr}  [${timeStr}]`);
    lines.push(`────────────────────────────────────────────────────────────`);
    lines.push(``);
    lines.push(stripMarkdown(event.text));
    lines.push(``);
  }

  lines.push(`════════════════════════════════════════════════════════════`);
  lines.push(`  End of Advisory Session Transcript`);
  lines.push(`════════════════════════════════════════════════════════════`);

  return lines.join("\n");
}

/**
 * Generate a clean Markdown (.md) export with round grouping.
 */
export function formatMarkdownFileExport(session: AdvisorySession, events: AdvisoryEvent[]): string {
  const topic = session.topic;
  const mode = session.mode;
  const dateStr = new Date(session.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const rawOverlays = (session as unknown as Record<string, unknown>).personaOverlays;
  const overlaysObj: Record<string, string> = Array.isArray(rawOverlays)
    ? {}
    : (rawOverlays as Record<string, string>) ?? {};

  const allEvents = events as (AdvisoryEvent & { model?: string })[];
  const modelsUsed = [...new Set(allEvents.map((e) => e.model).filter(Boolean))];
  const modelsStr = modelsUsed.length > 0 ? modelsUsed.join(", ") : "N/A";

  // Build participants line
  const participantParts: string[] = [];
  for (const agentDisplayName of session.agents) {
    const agentConfig = getAgentByAnyId(agentDisplayName);
    const emoji = agentConfig?.emoji ?? "🤖";
    participantParts.push(`${agentDisplayName} ${emoji}`);
  }

  // Compute rounds from display events
  const displayEvents = events.filter((e) => e.text && e.speaker && e.type !== "start");
  const agentEvents = displayEvents.filter(
    (e) => e.speaker !== "the user" && e.speaker !== "System" && e.type !== "complete" && e.type !== "error"
  );
  const roundForEvent = new Map<string, number>();
  let round = 1;
  const seenInRound = new Set<string>();
  for (const e of agentEvents) {
    if (seenInRound.has(e.speaker)) {
      round++;
      seenInRound.clear();
    }
    seenInRound.add(e.speaker);
    roundForEvent.set(e.id, round);
  }
  const totalRounds = round;
  // Backfill non-agent events
  let lastRound = 1;
  for (const e of displayEvents) {
    if (roundForEvent.has(e.id)) {
      lastRound = roundForEvent.get(e.id)!;
    } else {
      roundForEvent.set(e.id, lastRound);
    }
  }

  const modeLabel = mode === "competitive"
    ? "Competitive Ideation"
    : mode === "formal-board"
    ? "Formal Board Review"
    : "Roundtable";
  const lines: string[] = [
    `# ${topic}`,
    ``,
    `**Date:** ${dateStr} | **Mode:** ${modeLabel} | **Model:** ${modelsStr} | **Rounds:** ${totalRounds}`,
    `**Participants:** ${participantParts.join(", ")}`,
    ``,
    `---`,
    ``,
  ];

  let prevRound = 0;
  for (const event of displayEvents) {
    const eventRound = roundForEvent.get(event.id) ?? 1;

    if (eventRound > prevRound) {
      if (eventRound > 1) lines.push(`---`, ``);
      lines.push(`## Round ${eventRound}`, ``);
    }
    prevRound = eventRound;

    const agentConfig = getAgentByAnyId(event.speaker);
    const role = agentConfig?.role ?? getAgentRole(event.speaker);
    const emoji = agentConfig?.emoji ?? event.emoji ?? "";
    const speakerOverlayId = overlaysObj[event.speaker];
    const overlayStr = speakerOverlayId
      ? ` [${getOverlayEmoji(speakerOverlayId)} ${getOverlayName(speakerOverlayId)}]`
      : "";
    const timeStr = new Date(event.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    const isHuman = event.speaker === "the user";
    const speakerName = isHuman ? "User" : event.speaker;
    const speakerRole = isHuman ? "CEO" : role;

    lines.push(`### ${emoji} ${speakerName} — ${speakerRole}${overlayStr}`);
    lines.push(`*${timeStr}*`);
    lines.push(``);
    lines.push(event.text.trim());
    lines.push(``);
  }

  // Overall assessment — look for moderator or Henry's "complete" type event
  const synthesisEvent = events.find((e) => e.type === "complete" && (e.role === "moderator" || e.speaker === "Henry"));
  if (synthesisEvent && synthesisEvent.text) {
    lines.push(`---`, ``);
    lines.push(`## Overall Assessment`);
    lines.push(`*${synthesisEvent.role === "moderator" ? `${synthesisEvent.speaker}'s moderator synthesis` : "Henry's synthesis"}*`);
    lines.push(``);
    lines.push(synthesisEvent.text.trim());
    lines.push(``);
  }

  return lines.join("\n");
}
