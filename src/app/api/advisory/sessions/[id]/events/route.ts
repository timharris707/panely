import { NextRequest, NextResponse } from "next/server";
import { getAdvisorySession } from "@/lib/advisory-session-store";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getAdvisorySession(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const after = url.searchParams.get("after");

    let events = session.events || [];
    if (after) {
      const idx = events.findIndex((e: { id: string }) => e.id === after);
      if (idx !== -1) {
        const nextEvents = events.slice(idx + 1);
        const currentEvent = events[idx] as { streaming?: boolean } | undefined;
        events = currentEvent?.streaming ? [events[idx], ...nextEvents] : nextEvents;
      }
    }

    return NextResponse.json({
      events,
      status: session.status,
      paused: session.paused ?? false,
      thinkingAgent: session.thinkingAgent ?? null,
      runInProgress: session.runInProgress ?? false,
      title: session.title ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
