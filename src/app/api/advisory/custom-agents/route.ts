import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const FILE_PATH = path.join(process.cwd(), "data", "advisory", "custom-agents.json");

function ensureFile() {
  const dir = path.dirname(FILE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE_PATH)) fs.writeFileSync(FILE_PATH, "[]");
}

function loadAgents(): CustomAgent[] {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function saveAgents(agents: CustomAgent[]) {
  ensureFile();
  fs.writeFileSync(FILE_PATH, JSON.stringify(agents, null, 2));
}

interface CustomAgent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  persona: string;
  division: string;
  createdAt: string;
}

export async function GET() {
  try {
    const agents = loadAgents();
    return NextResponse.json({ agents });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, emoji, role, persona, division } = body;

    if (!name || !role) {
      return NextResponse.json({ error: "name and role are required" }, { status: 400 });
    }

    const agents = loadAgents();

    // Prevent duplicate names
    if (agents.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: "An agent with this name already exists" }, { status: 409 });
    }

    const agent: CustomAgent = {
      id: `custom-${randomUUID().slice(0, 8)}`,
      name: name.trim(),
      emoji: emoji || "🤖",
      role: role.trim(),
      persona: persona?.trim() || "",
      division: division || "Custom",
      createdAt: new Date().toISOString(),
    };

    agents.push(agent);
    saveAgents(agents);

    return NextResponse.json({ agent });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id query parameter is required" }, { status: 400 });
    }

    const agents = loadAgents();
    const filtered = agents.filter((a) => a.id !== id);

    if (filtered.length === agents.length) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    saveAgents(filtered);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
