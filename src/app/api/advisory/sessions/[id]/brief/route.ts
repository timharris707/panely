import { NextRequest, NextResponse } from "next/server";
import { buildBoardBrief } from "@/lib/advisory-brief";
import { buildDecisionRecord } from "@/lib/advisory/decision-record";
import { getAdvisorySession, saveAdvisorySession, type AdvisorySessionRecord } from "@/lib/advisory-session-store";
import { getCurrentUser } from "@/lib/local-user";
import type { AdvisorySession } from "@/types/advisory";

function canAccess(session: AdvisorySessionRecord, userId: string) {
  return typeof session.userId !== "string" || session.userId === userId;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;
    const session = getAdvisorySession(id);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (!canAccess(session, user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const shouldRegenerate = new URL(req.url).searchParams.get("regenerate") === "1";
    const existingBrief = (session as AdvisorySession).brief;
    const existingRecord = (session as AdvisorySession).decisionRecord;
    const brief = shouldRegenerate || !existingBrief
      ? buildBoardBrief(session as AdvisorySession)
      : existingBrief;
    const decisionRecord = shouldRegenerate || !existingRecord
      ? buildDecisionRecord(session as AdvisorySession)
      : existingRecord;

    if (shouldRegenerate || !existingBrief || !existingRecord) {
      saveAdvisorySession({ ...session, brief, decisionRecord });
    }

    return NextResponse.json({ brief, decisionRecord });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;
    const session = getAdvisorySession(id);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (!canAccess(session, user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const brief = buildBoardBrief(session as AdvisorySession);
    const decisionRecord = buildDecisionRecord(session as AdvisorySession);
    saveAdvisorySession({ ...session, brief, decisionRecord });
    return NextResponse.json({ brief, decisionRecord });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
