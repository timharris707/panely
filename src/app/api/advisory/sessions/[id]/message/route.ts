import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { sessionFileStore as fs } from "@/lib/advisory-session-store";
import { spawnAdvisoryAgentWithRetry } from "@/lib/advisory-agent";
import { withSessionLock } from "@/lib/session-lock";
import { buildHistoryString } from "@/lib/advisory-history";

const DATA_DIR = path.join(process.cwd(), "data", "advisory");

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
    const raw = fs.readFileSync(filePath, "utf-8");
    const session = JSON.parse(raw);

    const { text } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const eventId = `evt_${String(Date.now()).slice(-6)}`;
    const event = {
      id: eventId,
      timestamp: new Date().toISOString(),
      type: "human-directive",
      speaker: "the user",
      emoji: "👤",
      role: "supervisor",
      text: `**[Human Directive]** ${text}`,
    };

    await withSessionLock(id, async () => {
      const freshRaw = fs.readFileSync(filePath, "utf-8");
      const freshSession = JSON.parse(freshRaw);
      freshSession.events = [...(freshSession.events || []), event];
      fs.writeFileSync(filePath, JSON.stringify(freshSession, null, 2));
    });

    // Trigger a follow-up response from the next agent (fire-and-forget)
    // We call the run endpoint with a special flag via a background task
    triggerFollowUp(id, session, text).catch(console.error);

    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── Trigger a follow-up agent response to a human message ───────────────────

const AGENT_EMOJIS: Record<string, string> = {
  Henry: "⚡", Atlas: "📈", Nimbus: "🌤️", Cipher: "₿", Quant: "📊",
  Forge: "🔧", Pixel: "💻", Scout: "🔭", Quill: "✍️", Counsel: "⚖️",
};

const AGENT_ROLES: Record<string, string> = {
  Henry: "Chief of Staff / Orchestrator", Atlas: "Stocks & Options Trader",
  Nimbus: "Weather Prediction Trader", Cipher: "Crypto Trader",
  Quant: "Trading Strategy Architect", Forge: "Backend Engineer",
  Pixel: "Senior Full-Stack Engineer", Scout: "Research & Intelligence",
  Quill: "Creative Writer & Marketing Strategist", Counsel: "Legal Expert",
};

async function triggerFollowUp(
  sessionId: string,
  session: {
    agents: string[];
    topic: string;
    mode: string;
    personaOverlays?: string[];
    model?: string;
    agentModelOverrides?: Record<string, string>;
    events: Array<{ speaker: string; text: string; type: string }>;
  },
  humanMessage: string
) {
  const filePath = path.join(DATA_DIR, `${sessionId}.json`);
  const { agents, topic, mode } = session;

  // Pick the most relevant agent to respond (Henry if available, else first non-the user agent)
  const respondingAgentId = agents.includes("Henry") ? "Henry" : agents[0];
  if (!respondingAgentId) return;

  const emoji = AGENT_EMOJIS[respondingAgentId] || "💬";
  const role = AGENT_ROLES[respondingAgentId] || "Advisory Agent";

  // Read current session for history
  const currentRaw = fs.readFileSync(filePath, "utf-8");
  const currentSession = JSON.parse(currentRaw);
  if (currentSession.status !== "active") return;

  const historyLines = buildHistoryString(currentSession.events || []);

  const refBlock = currentSession.referenceContext
    ? `\n\nReference material provided for this session:\n${currentSession.referenceContext}\n`
    : "";

  const modeLabel = mode === "competitive"
    ? "competitive ideation session"
    : mode === "formal-board"
    ? "Formal Board Review session"
    : "roundtable discussion";

  const systemPrompt = `You are ${respondingAgentId} ${emoji}, the ${role} at Panely.

You are in a ${modeLabel} about: ${topic}${refBlock}

Respond directly to the human's directive. Be helpful, specific, and use your expertise.`;

  const userPrompt = `Previous discussion:\n\n${historyLines}\n\nTim (Human) just said: "${humanMessage}"\n\nRespond as ${respondingAgentId} to the user's directive. Be direct and specific.`;

  try {
    const selectedModel = session.agentModelOverrides?.[respondingAgentId] || session.model;
    const result = await spawnAdvisoryAgentWithRetry({
      sessionId,
      agentId: respondingAgentId,
      systemPrompt,
      userPrompt,
      timeoutSeconds: 120,
      model: selectedModel,
    });

    if (result.text) {
      const replyEvent = {
        id: `evt_reply_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: respondingAgentId === "Henry" ? "supervisor" : "worker",
        speaker: respondingAgentId,
        emoji,
        role: respondingAgentId === "Henry" ? "supervisor" : "worker",
        text: result.text,
        model: result.model,
        modelSource: result.model,
      };

      await withSessionLock(sessionId, async () => {
        const latestRaw = fs.readFileSync(filePath, "utf-8");
        const latestSession = JSON.parse(latestRaw);
        latestSession.events = [...(latestSession.events || []), replyEvent];
        fs.writeFileSync(filePath, JSON.stringify(latestSession, null, 2));
      });
    }
  } catch (err) {
    console.error("Follow-up agent response error:", err);
  }
}
