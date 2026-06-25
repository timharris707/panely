import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/local-user";
import {
  listAdvisorySessions,
  saveAdvisorySession,
  type AdvisorySessionRecord,
} from "@/lib/advisory-session-store";

const DEFAULT_REFERENCE_CONTEXT_BUDGET_CHARS = 50_000;
const MAX_REFERENCE_CONTEXT_BUDGET_CHARS = 1_000_000;

function resolveReferenceContextBudget(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_REFERENCE_CONTEXT_BUDGET_CHARS;
  return Math.min(Math.trunc(parsed), MAX_REFERENCE_CONTEXT_BUDGET_CHARS);
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    const sessions = listAdvisorySessions(user.id);

    // Return lightweight list (no events)
    const list = sessions.map(({ events: _events, ...rest }) => ({
      ...rest,
      eventCount: _events?.length ?? 0,
      lastEvent: _events?.length ? _events[_events.length - 1] : null,
    }));
    return NextResponse.json({ sessions: list });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const { topic, mode, agents, model, personaOverlays, personaOverlaysList, aiPersonas, rounds, pacing, responseLength, extendedThinking, specialist, specialistAgent, forkedFrom, forkedAtEvent, referenceContext, referenceContextBudgetChars, agentModelOverrides, agentPersonalityTraits, agentCommunicationStyles, agentIntensityLevels, agentResponseLengths, agentThinkingLevels, moderator, competitiveVoteMode, competitiveTopCount } = body;

    if (!topic || !mode) {
      return NextResponse.json({ error: "topic and mode are required" }, { status: 400 });
    }

    if (mode !== "roundtable" && mode !== "competitive") {
      return NextResponse.json({ error: "mode must be roundtable or competitive" }, { status: 400 });
    }

    const id = `session-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const resolvedReferenceContextBudget = resolveReferenceContextBudget(referenceContextBudgetChars);

    const isCompetitive = mode === "competitive";
    const resolvedCompetitiveVoteMode: "agent-winner" | "top-ideas" = competitiveVoteMode === "top-ideas" ? "top-ideas" : "agent-winner";
    const resolvedCompetitiveTopCount = Math.max(1, Math.min(10, Number(competitiveTopCount) || 3));
    const competitiveState = isCompetitive ? {
      phase: "pitch" as const,
      voteMode: resolvedCompetitiveVoteMode,
      topCount: resolvedCompetitiveTopCount,
      pitches: {} as Record<string, string>,
      votes: [] as Array<{ voter: string; votedFor: string; reasoning: string }>,
      winner: null,
      voteTally: {} as Record<string, number>,
    } : undefined;

    const startText = isCompetitive
      ? `⚔️ **Competitive Ideation started.**\n\n**Topic:** ${topic}\n\n**Mode:** Competitive Ideation | **Model:** ${model || "claude-sonnet"}\n\n**Competitors:** ${(agents || []).join(", ") || "TBD"}\n\n**Round 1 — PITCH:** Each agent pitches ${resolvedCompetitiveVoteMode === "top-ideas" ? "their top three improvement ideas" : "their boldest idea"}.\n**Round 2 — CRITIQUE:** Agents stress-test the ideas by name.\n**Round 3 — VOTE:** ${resolvedCompetitiveVoteMode === "top-ideas" ? `Each agent votes for the top ${resolvedCompetitiveTopCount} ideas overall.` : "Each agent votes for the best idea (not their own) with reasoning."}\n\nLet the competition begin...`
      : `🚀 **Session started.**\n\n**Topic:** ${topic}\n\n**Mode:** Roundtable | **Model:** ${model || "claude-sonnet"}\n\n**Participants:** ${(agents || []).join(", ") || "TBD"}\n\nStanding by for agent inputs...`;

    const session: AdvisorySessionRecord = {
      id,
      userId: user.id,
      topic,
      mode,
      agents: agents || [],
      status: "active",
      createdAt: now,
      model: model || "claude-sonnet",
      personaOverlays: personaOverlays || [],
      personaOverlaysList: personaOverlaysList || undefined,
      aiPersonas: aiPersonas || undefined,
      rounds: rounds ?? 3,
      pacing: pacing || "instant",
      responseLength: responseLength || "balanced",
      extendedThinking: extendedThinking || false,
      specialist: specialist || false,
      specialistAgent: specialistAgent || null,
      forkedFrom: forkedFrom || null,
      forkedAtEvent: forkedAtEvent || null,
      referenceContext: referenceContext ? String(referenceContext).slice(0, resolvedReferenceContextBudget) : undefined,
      referenceContextBudgetChars: resolvedReferenceContextBudget,
      paused: false,
      ...(agentPersonalityTraits && Object.keys(agentPersonalityTraits).length > 0 ? { agentPersonalityTraits } : {}),
      ...(agentCommunicationStyles && Object.keys(agentCommunicationStyles).length > 0 ? { agentCommunicationStyles } : {}),
      ...(agentIntensityLevels && Object.keys(agentIntensityLevels).length > 0 ? { agentIntensityLevels } : {}),
      ...(agentResponseLengths && Object.keys(agentResponseLengths).length > 0 ? { agentResponseLengths } : {}),
      ...(agentThinkingLevels && Object.keys(agentThinkingLevels).length > 0 ? { agentThinkingLevels } : {}),
      ...(agentModelOverrides && Object.keys(agentModelOverrides).length > 0 ? { agentModelOverrides } : {}),
      ...(competitiveState ? { competitive: competitiveState } : {}),
      ...(isCompetitive ? { competitiveVoteMode: resolvedCompetitiveVoteMode, competitiveTopCount: resolvedCompetitiveTopCount } : {}),
      ...(moderator ? { moderator } : {}),
      events: [
        {
          id: "evt_001",
          timestamp: now,
          type: "start",
          speaker: moderator || "Henry",
          emoji: isCompetitive ? "⚔️" : "⚡",
          role: moderator ? "moderator" : "supervisor",
          text: startText,
        },
      ],
    };

    saveAdvisorySession(session);

    return NextResponse.json({ session });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
