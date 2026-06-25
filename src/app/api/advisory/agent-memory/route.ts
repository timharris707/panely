import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const MEMORY_FILE = path.join(process.cwd(), "data", "advisory", "agent-memory.json");

export interface AgentMemoryEntry {
  id: string;
  agent: string;
  topic: string;
  sessionId: string;
  date: string;
  decisions: string[];
  insights: string[];
  actionItems: string[];
}

function readMemory(): AgentMemoryEntry[] {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return [];
    const raw = fs.readFileSync(MEMORY_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeMemory(entries: AgentMemoryEntry[]) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(entries, null, 2));
}

// GET — list memory entries, optionally filtered by ?agent=Name
export async function GET(req: NextRequest) {
  const agent = req.nextUrl.searchParams.get("agent");
  const entries = readMemory();
  const filtered = agent
    ? entries.filter((e) => e.agent.toLowerCase() === agent.toLowerCase())
    : entries;
  return NextResponse.json({ entries: filtered });
}

// DELETE — clear memory for a specific agent (?agent=Name) or all
export async function DELETE(req: NextRequest) {
  const agent = req.nextUrl.searchParams.get("agent");
  if (agent) {
    const entries = readMemory();
    const remaining = entries.filter((e) => e.agent.toLowerCase() !== agent.toLowerCase());
    writeMemory(remaining);
    return NextResponse.json({ ok: true, message: `Cleared memory for ${agent}`, remaining: remaining.length });
  }
  writeMemory([]);
  return NextResponse.json({ ok: true, message: "All agent memory cleared" });
}
