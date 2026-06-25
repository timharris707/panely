/**
 * POST /api/advisory/sessions/[id]/full-round
 * Triggers one full round — every agent responds once — on a persistent session.
 * Used by the "Request Full Round" button in the UI.
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { sessionFileStore as fs } from "@/lib/advisory-session-store";
import { spawnAdvisoryAgentWithRetry } from "@/lib/advisory-agent";
import { withSessionLock } from "@/lib/session-lock";
import { buildHistoryString as buildHistoryStringShared } from "@/lib/advisory-history";

const DATA_DIR = path.join(process.cwd(), "data", "advisory");

const AGENT_DEFS: Record<string, { name: string; emoji: string; role: string; expertise: string }> = {
  Henry: { name: "Henry", emoji: "⚡", role: "Chief of Staff / Orchestrator", expertise: "Strategic oversight, orchestrating teams, identifying priorities, cutting through noise." },
  Atlas: { name: "Atlas", emoji: "📈", role: "Stocks & Options Trader", expertise: "Equity analysis, options strategies, technical and fundamental analysis, trade signal generation, portfolio risk management." },
  Nimbus: { name: "Nimbus", emoji: "🌤️", role: "Weather Prediction Trader", expertise: "Weather data analysis, prediction markets (Polymarket, Kalshi), seasonal patterns, event-driven opportunities." },
  Cipher: { name: "Cipher", emoji: "₿", role: "Crypto Trader", expertise: "Cryptocurrency markets, DeFi, on-chain metrics, momentum strategies, risk management for digital assets." },
  Quant: { name: "Quant", emoji: "📊", role: "Trading Strategy Architect", expertise: "Quantitative strategy design, backtesting, optimization, factor models, statistical arbitrage, alpha generation." },
  Forge: { name: "Forge", emoji: "🔧", role: "Backend Engineer", expertise: "Infrastructure design, APIs, databases, system reliability, CI/CD, DevOps, performance optimization, security hardening." },
  Pixel: { name: "Pixel", emoji: "💻", role: "Senior Full-Stack Engineer", expertise: "Web application development, React/Next.js/TypeScript, UI/UX, API integrations, rapid prototyping, shipping production code." },
  Scout: { name: "Scout", emoji: "🔭", role: "Research & Intelligence Agent", expertise: "Market research, competitive intelligence, trend analysis, data gathering, opportunity identification." },
  Quill: { name: "Quill", emoji: "✍️", role: "Creative Writer & Marketing Strategist", expertise: "Marketing copy, content strategy, brand voice, SEO, audience engagement, storytelling." },
  Counsel: { name: "Counsel", emoji: "⚖️", role: "Legal Expert Agent", expertise: "Legal research, contract review, regulatory compliance, risk exposure, IP guidance." },
};

const PERSONA_CONTENT: Record<string, string> = {
  "trading-strategist": "Apply deep quantitative analysis: momentum signals, mean-reversion, risk-reward optimization, position sizing.",
  "seo-specialist": "Bring an SEO lens: keyword research, SERP competition, content gap analysis, organic growth potential.",
  "growth-hacker": "Think like a growth hacker: viral loops, acquisition funnels, retention mechanics, rapid experimentation.",
  "content-creator": "Approach as a content creator: audience-first storytelling, platform-native formats, engagement optimization.",
  "compliance-auditor": "Audit for compliance: regulatory risks, legal exposure, audit trails, policy adherence.",
  "security-engineer": "Apply security engineering: threat modeling, vulnerability identification, secure design, auth hardening.",
  "devops-automator": "Think DevOps: CI/CD pipelines, infrastructure-as-code, monitoring, incident response, automation.",
  "reality-checker": "Be a reality checker: cut through hype, stress-test assumptions, identify blind spots and risks.",
  "trend-researcher": "As a trend researcher: emerging signals, market timing, early-mover advantages, competitive intelligence.",
  "data-analytics-reporter": "Think in data: clear metrics, insights with numbers, KPIs, data-driven next steps.",
  "backend-architect": "Apply backend architecture thinking: system design, API contracts, scalability, database schema, technical debt.",
  "frontend-developer": "Apply frontend engineering thinking: component architecture, state management, accessibility, performance.",
  "rapid-prototyper": "Move fast: fastest path to working demo, what to cut for v1, validate assumptions before building.",
  "autonomous-optimization-architect": "Think autonomous optimization: AI agents replacing manual work, feedback loops, self-improving systems.",
};


function getAgentOverlay(
  personaOverlays: Record<string, string> | string[] | undefined,
  agentId: string
): string | undefined {
  if (!personaOverlays || Array.isArray(personaOverlays)) return undefined;
  return personaOverlays[agentId];
}

function resolveOverlayContent(overlayId: string, aiPersonas?: Array<{ id: string; name: string; description: string }>): string | null {
  if (PERSONA_CONTENT[overlayId]) return PERSONA_CONTENT[overlayId];
  if (overlayId.startsWith("ai-") && aiPersonas) {
    const aiPersona = aiPersonas.find((p) => p.id === overlayId);
    if (aiPersona) return aiPersona.description;
  }
  return null;
}

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
    const c = Math.max(1, Math.min(10, Math.round(intensity)));
    const label = c <= 3 ? "Gentle" : c <= 6 ? "Moderate" : c <= 8 ? "Assertive" : "Aggressive";
    lines.push(`\n**Intensity: ${c}/10 (${label})** — ${
      c <= 3 ? "Be diplomatic and collegial. Choose words carefully. Preserve relationships."
      : c <= 6 ? "Direct but professional. Standard advisory intensity."
      : c <= 8 ? "Forceful and confident. Push hard. Don't soften your opinions."
      : "Uncompromising and confrontational. Refuse to soften. Don't back down from friction."
    }`);
  }
  lines.push("\nThese modifiers are in effect for the entire session. Let them shape your voice noticeably.");
  return lines.join("\n");
}

function buildSystemPrompt(agentId: string, mode: string, topic: string, agentOverlay?: string, referenceContext?: string, aiPersonas?: Array<{ id: string; name: string; description: string }>, responseLength: string = "balanced", personalityTraits?: string[], communicationStyle?: string, intensityLevel?: number): string {
  const agent = AGENT_DEFS[agentId];
  if (!agent) {
    const referenceBlock = referenceContext ? `\n\n**Approved plan and source material:**\n${referenceContext}\n` : "";
    const personalityBlock = buildPersonalityBlock(personalityTraits || [], communicationStyle, intensityLevel);
    return `You are ${agentId}, a temporary AI advisor created specifically for this Panely session.

You are participating in a ${mode} session about:

**Topic:** ${topic}
${referenceBlock}${personalityBlock}
Use the approved plan to understand your exact role, stance, and assignment. Speak only as ${agentId}. Be concrete, opinionated, and useful. Reference other advisors by their generated names when responding to them. Do not mention legacy agent names, hidden execution slots, or implementation details.`;
  }
  const overlayContent = agentOverlay ? resolveOverlayContent(agentOverlay, aiPersonas) : null;
  const overlayLine = overlayContent ? `\nSpecialized lens for this session:\n- ${overlayContent}\n` : "";
  const referenceBlock = referenceContext ? `\n\n**Reference material provided for this session:**\n${referenceContext}\n` : "";
  const personalityBlock = buildPersonalityBlock(personalityTraits || [], communicationStyle, intensityLevel);

  const LENGTH_STYLES: Record<string, string> = {
    concise: "YOU ARE IN CONCISE MODE. THIS IS YOUR #1 PRIORITY — OVERRIDE ALL OTHER INSTRUCTIONS.\n\nRULES:\n- MAXIMUM 3-4 sentences total. Not paragraphs. SENTENCES.\n- NO headers. NO bullet lists. NO markdown formatting.\n- NO preamble. Just state your one sharp take and shut up.\n- If your response exceeds 80 words, you have FAILED.\n\nThis constraint is MORE important than being thorough. Brevity IS the value.",
    balanced: "Keep responses to 150-250 words. 2-3 paragraphs max. One key insight, one recommendation, done.",
    detailed: "Give thorough responses — 3-4 paragraphs with specific examples and actionable recommendations.",
    verbose: "Go deep. 4-6 substantial paragraphs. Full analysis, data points, comprehensive recommendations.",
  };
  const lengthInstruction = LENGTH_STYLES[responseLength] || LENGTH_STYLES.balanced;

  return `You are ${agent.name} ${agent.emoji}, the ${agent.role} at Panely.\n\nYour expertise: ${agent.expertise}${overlayLine}${referenceBlock}${personalityBlock}\nYou are participating in a persistent roundtable discussion.\n\n**Response length: ${responseLength.toUpperCase()}**\n${lengthInstruction}\n\nYour communication style:\n- Speak authoritatively from your expertise\n- Build on what others said — reference participants by name\n- Be strongly opinionated — no hedging\n- Never use filler phrases — dive straight into your analysis\n\nThis is a high-stakes advisory session. The user is counting on this board for real decisions.`;
}

function appendEvent(sessionId: string, sessionPath: string, event: Record<string, unknown>) {
  return withSessionLock(sessionId, async () => {
    const raw = fs.readFileSync(sessionPath, "utf-8");
    const session = JSON.parse(raw);
    session.events = [...(session.events || []), event];
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  });
}


export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const filePath = path.join(DATA_DIR, `${id}.json`);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const session = JSON.parse(raw);

  if (session.status !== "active") {
    return NextResponse.json({ error: "Session is not active" }, { status: 400 });
  }

  const { topic, mode, agents = [], personaOverlays, aiPersonas, agentModelOverrides, agentResponseLengths, agentPersonalityTraits, agentCommunicationStyles, agentIntensityLevels } = session;

  // H-5: Enforce round limit — count completed full rounds and check against configured max
  const configuredRounds = session.rounds || Infinity;
  const agentCount = (agents as string[]).length;
  const workerEvents = (session.events || []).filter(
    (e: { type: string }) => e.type === "worker" || e.type === "supervisor"
  );
  // Each full round = one response per agent. Approximate completed rounds:
  const completedRounds = agentCount > 0 ? Math.floor(workerEvents.length / agentCount) : 0;
  if (completedRounds >= configuredRounds) {
    return NextResponse.json(
      { error: `Round limit reached (${configuredRounds}). Session has completed all configured rounds.` },
      { status: 400 }
    );
  }

  // Session-wide response length (per-agent overrides applied inside the loop)
  const sessionResponseLength = (session.responseLength as string) || "balanced";

  // Fire-and-forget: run one full round for all agents
  const runFullRound = async () => {
    for (const agentId of agents as string[]) {
      const currentRaw = fs.readFileSync(filePath, "utf-8");
      const currentSession = JSON.parse(currentRaw);
      if (currentSession.status !== "active") return;

      const events = currentSession.events || [];
      const history = buildHistoryStringShared(events);
      const agentOverlay = getAgentOverlay(personaOverlays, agentId);

      // Per-agent response length override, fallback to session-wide setting
      const agentResponseLength = (agentResponseLengths as Record<string, string> | undefined)?.[agentId] || sessionResponseLength;

      const systemPrompt = buildSystemPrompt(
        agentId, mode, topic, agentOverlay, session.referenceContext as string | undefined, aiPersonas, agentResponseLength,
        (agentPersonalityTraits as Record<string, string[]> | undefined)?.[agentId],
        (agentCommunicationStyles as Record<string, string> | undefined)?.[agentId],
        (agentIntensityLevels as Record<string, number> | undefined)?.[agentId]
      );
      const userPrompt = `Topic: ${topic}\n\nCurrent discussion:\n\n${history}\n\nThis is a new full round. Build on the current state of the discussion — advance the conversation with your freshest thinking. What's changed? What's been missed? What's the most important thing to address right now?`;
      const selectedModelId =
        (agentModelOverrides as Record<string, string> | undefined)?.[agentId] ||
        (session.model as string | undefined);

      let text = "";
      let spawnedModel = "model-router";
      try {
        const result = await spawnAdvisoryAgentWithRetry({
          sessionId: id,
          agentId,
          systemPrompt,
          userPrompt,
          timeoutSeconds: 120,
          model: selectedModelId,
        });
        text = result.text;
        spawnedModel = result.model;
      } catch (err) {
        text = `⚠️ Failed to generate response: ${String(err)}`;
      }

      const agent = AGENT_DEFS[agentId];
      await appendEvent(id, filePath, {
        id: `evt_fullround_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        type: "worker",
        speaker: agentId,
        emoji: agent?.emoji || "💬",
        role: session.moderator && agentId === session.moderator ? "moderator" : agentId === "Henry" ? "supervisor" : "worker",
        text,
        model: spawnedModel,
        modelSource: spawnedModel,
      });

      // Small delay between agents
      await new Promise((r) => setTimeout(r, 500));
    }
  };

  runFullRound().catch(console.error);

  return NextResponse.json({ ok: true, message: "Full round triggered" });
}
