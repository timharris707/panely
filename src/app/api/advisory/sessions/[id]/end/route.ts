import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { sessionFileStore as fs } from "@/lib/advisory-session-store";
import { spawnAdvisoryAgentWithRetry } from "@/lib/advisory-agent";
import { buildHistoryString } from "@/lib/advisory-history";
import { appendEventLocked, updateSessionLocked } from "@/lib/advisory/session-mutations";
import { buildRequestedModelProvenance } from "@/lib/advisory/provenance";
import type { AdvisoryEvent } from "@/types/advisory";

const DATA_DIR = path.join(process.cwd(), "data", "advisory");
const CUSTOM_AGENTS_FILE = path.join(DATA_DIR, "custom-agents.json");

function loadCustomAgentDefs(): Record<string, { name: string; emoji: string; role: string }> {
  try {
    if (fs.existsSync(CUSTOM_AGENTS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CUSTOM_AGENTS_FILE, "utf-8"));
      const defs: Record<string, { name: string; emoji: string; role: string }> = {};
      for (const a of raw) {
        defs[a.name] = {
          name: a.name,
          emoji: a.emoji || "🤖",
          role: a.role || "Advisory Board Member",
        };
      }
      return defs;
    }
  } catch {}
  return {};
}

const AGENT_DEFS: Record<string, { name: string; emoji: string; role: string }> = {
  Henry: { name: "Henry", emoji: "⚡", role: "Chief of Staff / Orchestrator" },
  Atlas: { name: "Atlas", emoji: "📈", role: "Stocks & Options Trader" },
  Nimbus: { name: "Nimbus", emoji: "🌤️", role: "Weather Prediction Trader" },
  Cipher: { name: "Cipher", emoji: "₿", role: "Crypto Trader" },
  Quant: { name: "Quant", emoji: "📊", role: "Trading Strategy Architect" },
  Forge: { name: "Forge", emoji: "🔧", role: "Backend Engineer" },
  Pixel: { name: "Pixel", emoji: "💻", role: "Senior Full-Stack Engineer" },
  Scout: { name: "Scout", emoji: "🔭", role: "Research & Intelligence Agent" },
  Quill: { name: "Quill", emoji: "✍️", role: "Creative Writer & Marketing" },
  Counsel: { name: "Counsel", emoji: "⚖️", role: "Legal Expert Agent" },
};

// ─── Main handler ─────────────────────────────────────────────────────────────

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

  // Immediately set aborted flag so any in-flight agent generation discards its response
  session.aborted = true;
  session.status = "completed";
  await updateSessionLocked(id, (currentSession) => ({
    ...currentSession,
    aborted: true,
    status: "completed",
  }));

  const { topic, agents = [], personaOverlays = {} } = session;

  // Pick the synthesizer — moderator if set, then Henry, then first agent
  const moderatorId = session.moderator as string | undefined;
  const synthAgentId: string = moderatorId || ((agents as string[]).includes("Henry") ? "Henry" : ((agents as string[])[0] || "Henry"));
  // Look up synth agent from built-in defs, custom agents file, or session metadata
  let synthAgent: { name: string; emoji: string; role: string } | undefined = AGENT_DEFS[synthAgentId];
  if (!synthAgent) {
    const customDefs = loadCustomAgentDefs();
    synthAgent = customDefs[synthAgentId];
  }
  if (!synthAgent && session.customAgentMeta) {
    const meta = (session.customAgentMeta as Record<string, { name: string; emoji: string; role: string }>)[synthAgentId];
    if (meta) synthAgent = meta;
  }
  if (!synthAgent) {
    // Fallback for completely unknown agents
    synthAgent = { name: synthAgentId, emoji: "🤖", role: "Advisory Board Member" };
  }
  const isModerator = !!moderatorId;

  // Build the full discussion history
  const history = buildHistoryString(session.events || []);

  // Overlay names for context
  const overlayObj = Array.isArray(personaOverlays) ? {} : personaOverlays as Record<string, string>;
  const overlayNames = Object.values(overlayObj).filter(Boolean);
  const overlayContext = overlayNames.length > 0 ? `\n\nSession context lenses: ${overlayNames.join(", ")}` : "";

  const moderatorPreamble = isModerator ? `\n\nAs the session **moderator**, you have guided this entire discussion. Your synthesis carries the authority of someone who has heard every perspective and shaped the conversation's direction. Deliver your closing statement with the confidence of a moderator who has been steering this from the beginning.\n` : "";

  const systemPrompt = `You are ${synthAgent?.name ?? synthAgentId} ${synthAgent?.emoji ?? "⚡"}, the ${synthAgent?.role ?? "Chief of Staff"} at Panely.

You are delivering the final synthesis for an advisory board session that the user has chosen to end. This is your closing statement.${moderatorPreamble}

You MUST use EXACTLY this structure with these markdown headers. Do not skip any section:

## Overall Assessment
[2-3 paragraphs synthesizing the full discussion — what was debated, where consensus formed, and the overall verdict on the topic. Be specific, reference actual points made by participants.]

## Key Decisions
- [Decision 1 — who advocated for it and why it was agreed upon]
- [Decision 2]
- [Continue for each concrete conclusion reached]

## Action Items
- [ ] [Agent Name]: [Specific action item with timeline, e.g. "Draft the API spec by end of week"]
- [ ] [Agent Name]: [Action item with timeline]
- [ ] User: [Any action items for the user specifically]

## Open Questions
- [Question that surfaced but wasn't resolved]
- [Area that needs further research or a follow-up session]

## What the User Should Do Next
[1-2 concrete, actionable next steps the user should take immediately. Be direct and specific — not vague advice.]

Be direct, specific, and crisp. No filler. Reference the actual content of the discussion. The user is counting on this to be actionable.${overlayContext}`;

  const userPrompt = `Topic: ${topic}\n\nFull discussion:\n\n${history}\n\nDeliver the final synthesis. This session is now closing.`;

  // Fire-and-forget the synthesis
  const doEnd = async () => {
    let synthText = "";
    let spawnedModel = "model-router";
    let failed = false;
    try {
      const result = await spawnAdvisoryAgentWithRetry({
        sessionId: id,
        agentId: `${synthAgentId}-synthesis`,
        systemPrompt,
        userPrompt,
        timeoutSeconds: 180,
      });
      synthText = result.text;
      spawnedModel = result.model;
    } catch (err) {
      synthText = `⚠️ Could not generate synthesis: ${String(err)}\n\nSession has been marked as completed.`;
      failed = true;
    }

    const completeEvent: AdvisoryEvent = {
      id: `evt_synthesis_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: "complete",
      speaker: synthAgentId,
      emoji: synthAgent?.emoji ?? "⚡",
      role: isModerator ? "moderator" : synthAgentId === "Henry" ? "supervisor" : "worker",
      text: `**${isModerator ? "🎙️ Moderator's Final Synthesis" : "⚡ Final Synthesis"}**\n\n${synthText}`,
      verdict: "approve",
      model: spawnedModel,
      modelSource: spawnedModel,
      provenance: buildRequestedModelProvenance(undefined, failed ? undefined : spawnedModel),
      error: failed || undefined,
    };
    await appendEventLocked(id, completeEvent);

    // Mark session completed
    await updateSessionLocked(id, (freshSession) => ({
      ...freshSession,
      status: "completed",
      completedAt: new Date().toISOString(),
      outcome: "ended-by-user",
      paused: false,
    }));

    // Auto-extract insights
    try {
      const insightsUrl = new URL(`/api/advisory/sessions/${id}/insights`, "http://localhost:3000");
      fetch(insightsUrl.toString(), { method: "POST" }).catch((e) =>
        console.error("Auto-insights extraction failed:", e)
      );
    } catch (e) {
      console.error("Auto-insights trigger failed:", e);
    }

    // Leave the completed session visible in History. Archiving is a deliberate user action.
  };

  doEnd().catch(console.error);

  return NextResponse.json({ ok: true, message: "End session triggered" });
}
