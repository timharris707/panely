import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { sessionFileStore as fs } from "@/lib/advisory-session-store";
import { spawnAdvisoryAgentWithRetry } from "@/lib/advisory-agent";

const DATA_DIR = path.join(process.cwd(), "data", "advisory");
const MEMORY_FILE = path.join(DATA_DIR, "agent-memory.json");
const EXPORT_DIR = path.join(process.cwd(), "data", "exports");

// ─── Agent memory types ──────────────────────────────────────────────────────

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

function readAgentMemory(): AgentMemoryEntry[] {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return [];
    return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeAgentMemory(entries: AgentMemoryEntry[]) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(entries, null, 2));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ─── Build transcript markdown ────────────────────────────────────────────────

function buildTranscriptMarkdown(session: Record<string, unknown>): string {
  const topic = session.topic as string;
  const mode = session.mode as string;
  const agents = (session.agents as string[]) || [];
  const createdAt = session.createdAt as string;
  const pacing = (session.pacing as string) || "instant";
  const events = (session.events as Array<Record<string, unknown>>) || [];

  const dateStr = new Date(createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const modelsUsed = [...new Set(events.map((e) => e.model as string).filter(Boolean))];
  const modelsStr = modelsUsed.length > 0 ? modelsUsed.join(", ") : "N/A";

  const lines: string[] = [
    `# Advisory Board: ${topic}`,
    ``,
    `**Date:** ${dateStr} | **Mode:** ${mode} | **Pacing:** ${pacing}`,
    `**Participants:** ${agents.join(", ")}`,
    `**Model(s):** ${modelsStr}`,
    ``,
    `---`,
    ``,
  ];

  for (const event of events) {
    const speaker = event.speaker as string;
    const emoji = event.emoji as string;
    const text = event.text as string;
    const timestamp = event.timestamp as string;
    const role = (event.role as string) || "";
    const model = (event.model as string) || "";

    if (!text || !speaker) continue;

    const modelSuffix = model ? ` | *${model}*` : "";
    lines.push(`## ${emoji} ${speaker} (${role})${modelSuffix}`);
    lines.push(`*${formatTimestamp(timestamp)}*`);
    lines.push(``);
    lines.push(text);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  if (session.outcome) {
    lines.push(`**Outcome:** ${session.outcome}`);
    lines.push(``);
  }

  return lines.join("\n");
}

// ─── Archive logic ────────────────────────────────────────────────────────────

async function archiveSession(sessionId: string): Promise<{ success: boolean; error?: string; transcriptPath?: string }> {
  const filePath = path.join(DATA_DIR, `${sessionId}.json`);
  if (!fs.existsSync(filePath)) {
    return { success: false, error: "Session not found" };
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const session = JSON.parse(raw);

  const topic = session.topic as string;
  const agents = (session.agents as string[]) || [];
  const events = (session.events as Array<Record<string, unknown>>) || [];
  const createdAt = session.createdAt as string;

  const dateSlug = new Date(createdAt).toISOString().split("T")[0];
  const topicSlug = slugify(topic);
  const fileName = `${dateSlug}-${topicSlug}.md`;

  // ── 1. Save transcript ──────────────────────────────────────────────────────
  const advisoryMemDir = path.join(EXPORT_DIR, "advisory");
  ensureDir(advisoryMemDir);

  const transcriptPath = path.join(advisoryMemDir, fileName);
  const transcriptMarkdown = buildTranscriptMarkdown(session);
  fs.writeFileSync(transcriptPath, transcriptMarkdown, "utf-8");

  // ── 2. Per-agent memory notes ───────────────────────────────────────────────
  const dateLabel = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  for (const agentId of agents) {
    const agentEvents = events.filter(
      (e) =>
        e.speaker === agentId &&
        e.type !== "start" &&
        e.type !== "complete" &&
        e.text
    );

    if (agentEvents.length === 0) continue;

    const agentContributions = agentEvents
      .map((e) => `${e.text}`)
      .join("\n\n---\n\n");

    const firstEvent = agentEvents[0];
    const role = (firstEvent?.role as string) || "participant";

    const outcomeStr = session.outcome
      ? `Outcome: ${session.outcome}`
      : "Outcome: session completed";

    // Generate summary via the configured model router
    let summaryBlock = "";
    try {
      const summarySystemPrompt = `You are summarizing an AI agent's contributions to an advisory board session. Be specific and concrete. Reference actual content from their contributions. Keep each bullet to 1-2 sentences.`;
      const summaryUserPrompt = `Agent: ${agentId}
Session Topic: ${topic}
Date: ${dateLabel}

This agent's contributions:
${agentContributions}

Generate a concise memory note for this agent. Format it exactly like this (fill in the brackets):

- Key points made:
  - [bullet 1 — specific point or recommendation they made]
  - [bullet 2 — specific point or recommendation they made]
  - [bullet 3 if applicable]
- Decisions: [key outcomes or decisions from the session, 1 sentence]
- Action items: [any specific action items this agent was assigned, or "None identified"]`;

      const summaryResult = await spawnAdvisoryAgentWithRetry({
        sessionId: sessionId,
        agentId: `${agentId}-archive-summary`,
        systemPrompt: summarySystemPrompt,
        userPrompt: summaryUserPrompt,
        timeoutSeconds: 60,
      });
      summaryBlock = summaryResult.text;
    } catch (err) {
      summaryBlock = `- Key points made:\n  - ${agentId} contributed to the advisory session\n- Decisions: ${outcomeStr}\n- Action items: None identified`;
      console.error(`Agent spawn summary failed for ${agentId}:`, err);
    }

    const agentMemDir = path.join(EXPORT_DIR, "agents", agentId);
    ensureDir(agentMemDir);

    const sessionsFile = path.join(agentMemDir, "sessions.md");
    const entryHeader = `### ${dateLabel} — ${topic}\n- Role: ${role}\n`;
    const entry = `${entryHeader}${summaryBlock}\n\n`;

    fs.appendFileSync(sessionsFile, entry, "utf-8");
  }

  // ── 3. Extract structured memory entries for agent-memory.json ──────────────
  try {
    const allContributions = events
      .filter((e) => e.type !== "start" && e.type !== "complete" && e.text && e.speaker !== "the user")
      .map((e) => `${e.speaker}: ${(e.text as string).slice(0, 500)}`)
      .join("\n\n");

    const memorySystemPrompt = `You are extracting structured memory from an advisory board session for future recall. Return ONLY the JSON array, no markdown fencing, no explanation.`;
    const memoryUserPrompt = `Session Topic: ${topic}
Date: ${dateLabel}
Session ID: ${session.id || "unknown"}
Participants: ${agents.join(", ")}

Conversation highlights:
${allContributions.slice(0, 6000)}

For EACH participating agent, extract their key contributions as structured JSON. Return a JSON array where each element has:
- "agent": agent name (string)
- "decisions": array of 1-3 key decisions or conclusions they drove (strings)
- "insights": array of 1-3 unique insights or analyses they provided (strings)
- "actionItems": array of 0-2 action items they were assigned or proposed (strings)

Keep each string to 1-2 sentences. Be specific and concrete. Only include agents who made substantive contributions.`;

    const memoryResult = await spawnAdvisoryAgentWithRetry({
      sessionId: sessionId,
      agentId: "Henry-archive-memory",
      systemPrompt: memorySystemPrompt,
      userPrompt: memoryUserPrompt,
      timeoutSeconds: 90,
    });
    const memoryJson = memoryResult.text;
    // Parse the LLM response — strip markdown fencing if present
    const cleaned = memoryJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as Array<{
      agent: string;
      decisions: string[];
      insights: string[];
      actionItems: string[];
    }>;

    if (Array.isArray(parsed)) {
      const existing = readAgentMemory();
      const newEntries: AgentMemoryEntry[] = parsed
        .filter((p) => p.agent && agents.includes(p.agent))
        .map((p) => ({
          id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          agent: p.agent,
          topic,
          sessionId: (session.id as string) || sessionId,
          date: new Date(createdAt).toISOString(),
          decisions: (p.decisions || []).slice(0, 3),
          insights: (p.insights || []).slice(0, 3),
          actionItems: (p.actionItems || []).slice(0, 2),
        }));
      writeAgentMemory([...existing, ...newEntries]);
    }
  } catch (memErr) {
    console.error("Agent memory extraction failed (non-critical):", memErr);
  }

  // ── 4. Mark session as archived ─────────────────────────────────────────────
  session.archived = true;
  session.archivedAt = new Date().toISOString();
  session.transcriptPath = transcriptPath;
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2));

  return { success: true, transcriptPath };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await archiveSession(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      message: "Session archived successfully",
      transcriptPath: result.transcriptPath,
    });
  } catch (err) {
    console.error("Archive error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
