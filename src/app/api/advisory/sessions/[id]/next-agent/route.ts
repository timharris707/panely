/**
 * POST /api/advisory/sessions/[id]/next-agent
 * Fires exactly ONE agent in a manual-pacing roundtable session.
 * Determines which agent goes next based on the current round cycle,
 * generates that agent's response, then pauses the session again.
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { sessionFileStore as fs } from "@/lib/advisory-session-store";
import { spawnAdvisoryAgentWithRetry } from "@/lib/advisory-agent";
import { updateSessionLocked } from "@/lib/advisory/session-mutations";
import { buildHistoryString as buildHistoryStringShared } from "@/lib/advisory-history";
import { buildRequestedModelProvenance } from "@/lib/advisory/provenance";
import type { AdvisoryEvent } from "@/types/advisory";

const DATA_DIR = path.join(process.cwd(), "data", "advisory");
const CUSTOM_AGENTS_FILE = path.join(DATA_DIR, "custom-agents.json");

function loadCustomAgentDefs(): Record<string, { name: string; emoji: string; role: string; expertise: string }> {
  try {
    if (fs.existsSync(CUSTOM_AGENTS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CUSTOM_AGENTS_FILE, "utf-8"));
      const defs: Record<string, { name: string; emoji: string; role: string; expertise: string }> = {};
      for (const a of raw) {
        defs[a.name] = {
          name: a.name,
          emoji: a.emoji || "🤖",
          role: a.role || "Advisory Board Member",
          expertise: a.persona || a.role || "General advisory expertise.",
        };
      }
      return defs;
    }
  } catch {}
  return {};
}

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
  // Check static overlays first
  if (PERSONA_CONTENT[overlayId]) return PERSONA_CONTENT[overlayId];
  // For AI-generated personas, use description from session metadata
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
  const agent = AGENT_DEFS[agentId] || loadCustomAgentDefs()[agentId];
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
  // Per-agent voice/style to make responses feel human and distinct
  const AGENT_VOICES: Record<string, string> = {
    Henry: `Your writing style:
- PUNCHY and decisive. Short sentences that hit hard. Then a longer analytical paragraph when depth matters.
- You're impatient with over-analysis. Cut to the chase. "Here's what we're doing. Here's why. Here's when."
- Occasional one-liner zingers: "Ship it." / "That's a $0 idea." / "Next."
- Mix very short paragraphs (1-2 sentences) with medium ones (3-4 sentences). NEVER write 5 uniform paragraphs.
- You set deadlines and hold people to them. Always end with a concrete action plan.
- Tone: confident, slightly irreverent, zero corporate speak.`,

    Quant: `Your writing style:
- DATA FIRST. Lead with numbers, percentages, probabilities. "The math says X."
- Dry, precise humor. Deadpan observations. "Our Sharpe ratio is negative infinity. That's not ideal."
- Structure responses with clear analytical frameworks: cost-benefit, risk-reward, expected value.
- Vary paragraph length — short data points, then longer analytical deep-dives, then a crisp conclusion.
- You're the skeptic at the table. Challenge fuzzy thinking with hard numbers.
- Include specific calculations: pricing, margins, breakeven, TAM estimates.
- Tone: analytical, occasionally sardonic, intellectually rigorous.`,

    Scout: `Your writing style:
- CURIOUS and research-driven. "I dug into this and here's what I found..."
- Lead with discoveries and insights from research, not opinions.
- Use bullet points naturally when listing findings or comparisons.
- Mix short observations ("Interesting data point:") with longer synthesis paragraphs.
- You spot things others miss. Connect unexpected dots. "What nobody's talking about is..."
- Include competitive intelligence, market data, trend signals.
- Tone: inquisitive, thorough, occasionally excited about a finding.`,

    Atlas: `Your writing style:
- TRADER'S MENTALITY. Think in terms of risk/reward, position sizing, market timing.
- Direct and action-oriented. "Buy signal. Here's the setup."
- Use market analogies even for non-trading topics. "This has a favorable risk/reward profile."
- Short punchy analysis followed by specific trade recommendations.
- Tone: confident, market-savvy, slightly aggressive.`,

    Nimbus: `Your writing style:
- PROBABILISTIC thinker. Express everything in terms of likelihood and confidence.
- "75% chance this works. Here's why, and here's the 25% scenario."
- Methodical and thorough but not boring. Layer insights clearly.
- Good at explaining complex models in plain language.
- Tone: measured, data-informed, quietly confident.`,

    Cipher: `Your writing style:
- CRYPTO-NATIVE. Think in terms of decentralization, network effects, community.
- Fast-paced, slightly edgy. "This is the play. Don't overthink it."
- Technical when needed but always ties back to practical implications.
- Short, punchy paragraphs. Rarely goes long.
- Tone: energetic, conviction-heavy, builder mentality.`,

    Forge: `Your writing style:
- SYSTEMS THINKER. See architecture and infrastructure in everything.
- "Here's how we build this to scale. Here's what breaks at 10x."
- Technical depth with practical wisdom. You've seen things fail at scale.
- Structured responses: problem → approach → tradeoffs → recommendation.
- Tone: pragmatic, experienced, slightly cautious about complexity.`,

    Pixel: `Your writing style:
- BUILDER. You think in terms of what can ship THIS WEEK.
- "Here's the MVP. Here's what we cut. Here's the user flow."
- Visual and concrete — describe UI, user journeys, feature specs.
- Mix wireframe-style descriptions with strategic thinking.
- Tone: energetic, ship-oriented, user-empathetic.`,

    Quill: `Your writing style:
- STORYTELLER. You frame everything as a narrative.
- "Here's the story we tell the market..." / "The user's journey starts when..."
- Creative and engaging prose. You make dry topics interesting.
- Vary rhythm intentionally — short punchy hooks followed by flowing narrative paragraphs.
- Tone: charismatic, brand-aware, audience-first.`,

    Counsel: `Your writing style:
- CAREFUL and precise. Words matter. Caveats matter.
- "The legal risk here is X. Mitigation: Y. Residual exposure: Z."
- Clear, structured analysis. Never ambiguous.
- Short definitive statements on clear issues, longer analysis on gray areas.
- Tone: authoritative, measured, risk-aware.`,
  };

  const voicePrompt = AGENT_VOICES[agentId] || `Your writing style:
- Give thorough, detailed responses with specific examples and recommendations.
- Vary your paragraph length — mix short punchy points with longer analysis.
- Be strongly opinionated. No hedging.`;

  // Length-aware instructions
  const LENGTH_INSTRUCTIONS: Record<string, string> = {
    concise: "YOU ARE IN CONCISE MODE. THIS IS YOUR #1 PRIORITY — OVERRIDE ALL OTHER INSTRUCTIONS.\n\nRULES:\n- MAXIMUM 3-4 sentences total. Not paragraphs. SENTENCES.\n- NO headers. NO bullet lists. NO markdown formatting.\n- NO preamble. NO 'Great question' or 'Building on what X said'.\n- Just state your one sharp take and shut up.\n- If your response exceeds 80 words, you have FAILED.\n\nThis constraint is MORE important than being thorough. Brevity IS the value.",
    balanced: "Keep it to 150-250 words. 2-3 paragraphs max. One key insight, one recommendation, done.",
    detailed: "Aim for 300-500 words. 3-4 paragraphs. Include analysis and specific recommendations.",
    verbose: "Go deep. 500+ words, full analysis, extensive examples, data points, and comprehensive recommendations.",
  };
  const lengthInstruction = LENGTH_INSTRUCTIONS[responseLength] || LENGTH_INSTRUCTIONS.balanced;
  const personalityBlock = buildPersonalityBlock(personalityTraits || [], communicationStyle, intensityLevel);

  return `You are ${agent.name} ${agent.emoji}, the ${agent.role} at Panely.\n\nYour expertise: ${agent.expertise}${overlayLine}${referenceBlock}${personalityBlock}\nYou are participating in a persistent roundtable discussion.\n\n${voicePrompt}\n\n**Response length: ${responseLength.toUpperCase()}**\n${lengthInstruction}\n\nIMPORTANT — Make your response feel HUMAN:\n- VARY your paragraph length. Some paragraphs should be 1 sentence. Others should be 4-5 sentences. Never make them all the same length.\n- Use occasional one-liners for emphasis.\n- Build on what others said — reference participants by name.\n- Propose concrete next steps, timelines, and resource requirements.\n- Never use filler phrases — dive straight into your analysis.\n\nThis is a high-stakes advisory session. The user is counting on this board for real decisions.`;
}

function determineNextAgent(agents: string[], events: Array<{ speaker: string; type: string }>): { agentId: string; isNewRound: boolean } {
  // Filter to only agent response events (not human, not system, not start/complete)
  const agentEvents = events.filter(
    (e) => e.speaker !== "the user" && e.speaker !== "System" && e.type !== "start" && e.type !== "complete" && e.type !== "human-directive"
  );

  // Track which agents have spoken in the current round
  const seenInCurrentRound = new Set<string>();
  for (const e of agentEvents) {
    if (seenInCurrentRound.has(e.speaker)) {
      // New round started — reset
      seenInCurrentRound.clear();
    }
    seenInCurrentRound.add(e.speaker);
  }

  // Find the first agent that hasn't spoken in this round
  for (const agentId of agents) {
    if (!seenInCurrentRound.has(agentId)) {
      return { agentId, isNewRound: seenInCurrentRound.size === 0 };
    }
  }

  // All agents have spoken — start a new round
  // But avoid the same agent speaking twice in a row
  const lastSpeaker = agentEvents.length > 0 ? agentEvents[agentEvents.length - 1].speaker : null;
  const firstAgent = agents[0];
  if (firstAgent === lastSpeaker && agents.length > 1) {
    return { agentId: agents[1], isNewRound: true };
  }
  return { agentId: firstAgent, isNewRound: true };
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

  // Session-wide response length (per-agent override resolved after agentId is determined)
  const sessionResponseLength = (session.responseLength as string) || "balanced";

  // Determine which agent goes next
  const events = session.events || [];

  // ── Round limit enforcement ──────────────────────────────────────────────
  const configuredRounds = session.rounds;
  if (configuredRounds && configuredRounds !== "persistent") {
    const roundLimit = Number(configuredRounds);
    if (!isNaN(roundLimit) && roundLimit > 0) {
      // Count completed rounds: a round is complete when every agent in session.agents has spoken once
      // Only count agent events from THIS session's events array
      const agentEvents = events.filter(
        (e: { speaker: string; type: string }) =>
          e.speaker !== "the user" && e.speaker !== "System" &&
          e.type !== "start" && e.type !== "complete" && e.type !== "human-directive"
      );
      const agentList = agents as string[];
      let completedRounds = 0;
      const seenInRound = new Set<string>();
      for (const e of agentEvents) {
        seenInRound.add(e.speaker);
        if (agentList.every((a: string) => seenInRound.has(a))) {
          completedRounds++;
          seenInRound.clear();
        }
      }

      console.log('Round check: completed=' + completedRounds + ' limit=' + roundLimit + ' agentEvents=' + agentEvents.length);

      // Guard: don't trigger round limit if no real agent responses yet
      if (completedRounds >= roundLimit && completedRounds > 0 && agentEvents.length > 0) {
        // Round limit reached — trigger synthesis and complete the session
        const endRes = await fetch(
          new URL(`/api/advisory/sessions/${id}/end`, _req.url).toString(),
          { method: "POST" }
        );
        const endOk = endRes.ok;
        if (!endOk) {
          console.error("Failed to trigger end-session from round limit enforcement");
        }
        return NextResponse.json({
          ok: true,
          sessionComplete: true,
          message: `Round limit (${roundLimit}) reached — session ending with synthesis.`,
        });
      }
    }
  }

  // ── Competitive mode: determine phase-aware next agent ─────────────────────
  const competitive = session.competitive as { phase: string; pitches: Record<string, string>; votes: Array<{ voter: string; votedFor: string; reasoning: string }>; winner: string | null; voteTally: Record<string, number> } | undefined;
  const isCompetitive = mode === "competitive" && competitive;

  const { agentId } = determineNextAgent(agents as string[], events);
  const agent = AGENT_DEFS[agentId] || loadCustomAgentDefs()[agentId];

  // Resolve per-agent response length (falls back to session-wide setting)
  const responseLength = (agentResponseLengths as Record<string, string> | undefined)?.[agentId] || sessionResponseLength;

  // Set thinkingAgent so the UI can show who's about to respond
  await updateSessionLocked(id, (s) => ({
    ...s,
    thinkingAgent: agentId,
    paused: false,
  }));

  // Fire-and-forget: generate the single agent response, then re-pause
  const generateResponse = async () => {
    const currentRaw = fs.readFileSync(filePath, "utf-8");
    const currentSession = JSON.parse(currentRaw);
    if (currentSession.status !== "active" || currentSession.aborted) return;

    const currentEvents = currentSession.events || [];
    const history = buildHistoryStringShared(currentEvents);
    const agentOverlay = getAgentOverlay(personaOverlays, agentId);

    // ── Competitive mode prompt building ──────────────────────────────────────
    let systemPrompt: string;
    let userPrompt: string;

    if (isCompetitive && competitive) {
      const compState = currentSession.competitive || competitive;
      const phase = compState.phase || "pitch";
      const pitches = compState.pitches || {};

      if (phase === "pitch") {
        systemPrompt = buildSystemPrompt(agentId, mode, topic, agentOverlay, session.referenceContext as string | undefined, aiPersonas, responseLength,
          (agentPersonalityTraits as Record<string, string[]> | undefined)?.[agentId],
          (agentCommunicationStyles as Record<string, string> | undefined)?.[agentId],
          (agentIntensityLevels as Record<string, number> | undefined)?.[agentId]
        );
        systemPrompt += `\n\n**MODE: COMPETITIVE IDEATION — PITCH**\nPitch ONE bold, specific, original idea. Name it. Include execution plan. You want to WIN.`;
        userPrompt = `Topic: ${topic}\n\n${history === "No prior discussion yet." ? "Pitch your idea NOW." : `Discussion so far:\n\n${history}\n\nNow pitch YOUR idea.`}`;
      } else if (phase === "critique") {
        const pitchSummary = Object.entries(pitches).map(([name, pitch]) => `═══ ${name.toUpperCase()}'S PITCH ═══\n${pitch}`).join("\n\n---\n\n");
        systemPrompt = buildSystemPrompt(agentId, mode, topic, agentOverlay, session.referenceContext as string | undefined, aiPersonas, responseLength,
          (agentPersonalityTraits as Record<string, string[]> | undefined)?.[agentId],
          (agentCommunicationStyles as Record<string, string> | undefined)?.[agentId],
          (agentIntensityLevels as Record<string, number> | undefined)?.[agentId]
        );
        systemPrompt += `\n\n**MODE: COMPETITIVE IDEATION — CRITIQUE**\nCritique all pitches. Reference each by name. Find flaws.\n\n**Pitches:**\n${pitchSummary}`;
        userPrompt = `Topic: ${topic}\n\nDiscussion:\n\n${history}\n\nCritique all pitches now.`;
      } else if (phase === "vote") {
        systemPrompt = buildSystemPrompt(agentId, mode, topic, agentOverlay, session.referenceContext as string | undefined, aiPersonas, responseLength,
          (agentPersonalityTraits as Record<string, string[]> | undefined)?.[agentId],
          (agentCommunicationStyles as Record<string, string> | undefined)?.[agentId],
          (agentIntensityLevels as Record<string, number> | undefined)?.[agentId]
        );
        systemPrompt += `\n\n**MODE: COMPETITIVE IDEATION — VOTE**\nVote for ONE idea (not your own). Format: **VOTE: [Agent Name]** then reasoning.`;
        userPrompt = `Topic: ${topic}\n\nDiscussion:\n\n${history}\n\nCast your vote now.`;
      } else {
        systemPrompt = buildSystemPrompt(agentId, mode, topic, agentOverlay, session.referenceContext as string | undefined, aiPersonas, responseLength,
          (agentPersonalityTraits as Record<string, string[]> | undefined)?.[agentId],
          (agentCommunicationStyles as Record<string, string> | undefined)?.[agentId],
          (agentIntensityLevels as Record<string, number> | undefined)?.[agentId]
        );
        userPrompt = `Topic: ${topic}\n\nDiscussion:\n\n${history}\n\nContribute.`;
      }
    } else {
      systemPrompt = buildSystemPrompt(
        agentId, mode, topic, agentOverlay, session.referenceContext as string | undefined, aiPersonas, responseLength,
        (agentPersonalityTraits as Record<string, string[]> | undefined)?.[agentId],
        (agentCommunicationStyles as Record<string, string> | undefined)?.[agentId],
        (agentIntensityLevels as Record<string, number> | undefined)?.[agentId]
      );
      userPrompt = `Topic: ${topic}\n\nCurrent discussion:\n\n${history}\n\nBuild on the current state of the discussion — advance the conversation with your freshest thinking. What's changed? What's been missed? What's the most important thing to address right now?`;
    }

    const selectedModelId =
      (agentModelOverrides as Record<string, string> | undefined)?.[agentId] ||
      (session.model as string | undefined);

    let text = "";
    let spawnedModel = "model-router";
    let failed = false;
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
      failed = true;
    }

    let shouldAutoEnd = false;
    await updateSessionLocked(id, (updatedSession) => {
      if (updatedSession.aborted || updatedSession.status !== "active") {
        return updatedSession;
      }

      const nextEvent: AdvisoryEvent = {
        id: `evt_next_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        type: failed ? "error" : "worker",
        speaker: agentId,
        emoji: agent?.emoji || "💬",
        role: session.moderator && agentId === session.moderator ? "moderator" : agentId === "Henry" ? "supervisor" : "worker",
        text,
        model: spawnedModel,
        modelSource: spawnedModel,
        provenance: buildRequestedModelProvenance(selectedModelId, failed ? undefined : spawnedModel),
        error: failed || undefined,
      };
      const nextEvents = [...(updatedSession.events || []), nextEvent];

      const configuredRounds = updatedSession.rounds;
      if (configuredRounds && configuredRounds !== "persistent") {
        const roundLimit = Number(configuredRounds);
        if (!isNaN(roundLimit) && roundLimit > 0) {
          const agentEvts = nextEvents.filter(
            (e: { speaker: string; type: string }) =>
              e.speaker !== "the user" && e.speaker !== "System" &&
              e.type !== "start" && e.type !== "complete" && e.type !== "human-directive"
          );
          const agentList = (updatedSession.agents || []) as string[];
          let completedRounds = 0;
          const seenInRound = new Set<string>();
          for (const e of agentEvts) {
            seenInRound.add(e.speaker);
            if (agentList.every((a: string) => seenInRound.has(a))) {
              completedRounds++;
              seenInRound.clear();
            }
          }
          if (completedRounds >= roundLimit && completedRounds > 0 && agentEvts.length > 0) {
            shouldAutoEnd = true;
            console.log(`[next-agent] Final round completed (${completedRounds}/${roundLimit}) — auto-triggering end session`);
          }
        }
      }

      return {
        ...updatedSession,
        events: nextEvents,
        thinkingAgent: null,
        paused: !shouldAutoEnd,
      };
    });

    if (shouldAutoEnd) {
      // Don't pause — trigger end-session synthesis instead

      try {
        // Determine the base URL from the request or fall back to localhost
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
        const endRes = await fetch(`${baseUrl}/api/advisory/sessions/${id}/end`, { method: "POST" });
        if (!endRes.ok) {
          console.error("[next-agent] Failed to trigger end-session after final round:", await endRes.text());
        }
      } catch (err) {
        console.error("[next-agent] Error triggering end-session after final round:", err);
      }
    }
  };

  generateResponse().catch((err) => {
    console.error("next-agent error:", err);
    // Clear thinking state on error
    updateSessionLocked(id, (s) => ({
      ...s,
      thinkingAgent: null,
      paused: true,
    })).catch(() => {});
  });

  return NextResponse.json({
    ok: true,
    nextAgent: agentId,
    message: `${agentId} is responding...`,
  });
}
