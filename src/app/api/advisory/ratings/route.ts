import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const RATINGS_FILE = path.join(process.cwd(), "data", "advisory", "ratings.json");

// Shape: { "AgentName": { up: number, down: number, topics: Record<string, { up: number, down: number }> } }
interface AgentRatings {
  up: number;
  down: number;
  topics: Record<string, { up: number; down: number }>;
}

type RatingsData = Record<string, AgentRatings>;

function readRatings(): RatingsData {
  try {
    if (!fs.existsSync(RATINGS_FILE)) return {};
    return JSON.parse(fs.readFileSync(RATINGS_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeRatings(data: RatingsData) {
  fs.writeFileSync(RATINGS_FILE, JSON.stringify(data, null, 2));
}

// GET — return all ratings, or for a specific agent (?agent=Name)
export async function GET(req: NextRequest) {
  const agent = req.nextUrl.searchParams.get("agent");
  const data = readRatings();

  if (agent) {
    const agentData = data[agent];
    if (!agentData) {
      return NextResponse.json({ agent, up: 0, down: 0, total: 0, pct: null, bestTopic: null });
    }
    const total = agentData.up + agentData.down;
    const pct = total > 0 ? Math.round((agentData.up / total) * 100) : null;

    // Find best topic
    let bestTopic: string | null = null;
    let bestScore = -1;
    for (const [topic, counts] of Object.entries(agentData.topics)) {
      const topicTotal = counts.up + counts.down;
      if (topicTotal > 0) {
        const score = counts.up / topicTotal;
        if (score > bestScore) {
          bestScore = score;
          bestTopic = topic;
        }
      }
    }

    return NextResponse.json({ agent, up: agentData.up, down: agentData.down, total, pct, bestTopic });
  }

  // Return summary for all agents
  const summary: Record<string, { up: number; down: number; total: number; pct: number | null; bestTopic: string | null }> = {};
  for (const [name, agentData] of Object.entries(data)) {
    const total = agentData.up + agentData.down;
    const pct = total > 0 ? Math.round((agentData.up / total) * 100) : null;

    let bestTopic: string | null = null;
    let bestScore = -1;
    for (const [topic, counts] of Object.entries(agentData.topics)) {
      const topicTotal = counts.up + counts.down;
      if (topicTotal > 0) {
        const score = counts.up / topicTotal;
        if (score > bestScore) {
          bestScore = score;
          bestTopic = topic;
        }
      }
    }

    summary[name] = { up: agentData.up, down: agentData.down, total, pct, bestTopic };
  }

  return NextResponse.json({ ratings: summary });
}

// POST — submit a rating { agent: string, rating: "up" | "down", topic?: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agent, rating, topic } = body;

    if (!agent || !["up", "down"].includes(rating)) {
      return NextResponse.json({ error: "agent and rating ('up'|'down') required" }, { status: 400 });
    }

    const data = readRatings();
    if (!data[agent]) {
      data[agent] = { up: 0, down: 0, topics: {} };
    }

    if (rating === "up") {
      data[agent].up++;
    } else {
      data[agent].down++;
    }

    if (topic) {
      if (!data[agent].topics[topic]) {
        data[agent].topics[topic] = { up: 0, down: 0 };
      }
      if (rating === "up") {
        data[agent].topics[topic].up++;
      } else {
        data[agent].topics[topic].down++;
      }
    }

    writeRatings(data);
    return NextResponse.json({ ok: true, agent, rating });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
