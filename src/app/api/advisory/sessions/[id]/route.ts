import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/local-user";
import {
  getAdvisorySession,
  saveAdvisorySession,
  type AdvisorySessionRecord,
} from "@/lib/advisory-session-store";

function canAccess(session: AdvisorySessionRecord, userId: string) {
  // Sessions without userId are legacy (dev data); allow access
  return typeof session.userId !== "string" || session.userId === userId;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    const { id } = await params;
    const session = getAdvisorySession(id);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    if (!canAccess(session, user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ session });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    const { id } = await params;
    const session = getAdvisorySession(id);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    if (!canAccess(session, user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updates = await req.json();
    const updated = saveAdvisorySession({ ...session, ...updates });
    return NextResponse.json({ session: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
