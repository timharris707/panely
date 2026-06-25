import { NextRequest, NextResponse } from "next/server";
import { getAdvisorySession, type AdvisorySessionRecord } from "@/lib/advisory-session-store";
import { createFormalResumeLease, getFormalResumeStatus } from "@/lib/advisory/formal-resume";
import { markStaleRunSteps } from "@/lib/advisory/run-ledger";
import { updateSessionLocked } from "@/lib/advisory/session-mutations";
import { getCurrentUser } from "@/lib/local-user";
import type { AdvisorySession } from "@/types/advisory";

function canAccess(session: AdvisorySessionRecord, userId: string) {
  return typeof session.userId !== "string" || session.userId === userId;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;
    const session = getAdvisorySession(id);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (!canAccess(session, user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let nextStep: ReturnType<typeof getFormalResumeStatus>["nextStep"];
    const leaseId = `resume_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    let blocked: { status: number; reason: string } | null = null;

    await updateSessionLocked(id, (current) => {
      const typed = current as AdvisorySession;
      if (typed.mode !== "formal-board" || !typed.formalBoard) {
        blocked = { status: 400, reason: "Session is not a Formal Board Review." };
        return current;
      }

      const markedSteps = markStaleRunSteps(typed.runSteps || [], now.getTime());
      const status = getFormalResumeStatus({ ...typed, runSteps: markedSteps }, now.getTime());
      if (!status.canResume) {
        blocked = { status: status.hasFreshLease || status.hasFreshRunningStep ? 409 : 400, reason: status.reason };
        return { ...current, runSteps: markedSteps };
      }

      nextStep = status.nextStep;
      return {
        ...current,
        status: "active",
        runInProgress: true,
        runSteps: markedSteps,
        formalBoard: {
          ...typed.formalBoard,
          resumeLease: createFormalResumeLease(leaseId, now),
        },
      };
    });

    const blockedResult = blocked as { status: number; reason: string } | null;
    if (blockedResult) {
      return NextResponse.json({ error: blockedResult.reason }, { status: blockedResult.status });
    }

    const runUrl = new URL(`/api/advisory/sessions/${id}/run`, req.url);
    const runResponse = await fetch(runUrl, { method: "POST" });
    if (!runResponse.ok) {
      await updateSessionLocked(id, (current) => {
        const typed = current as AdvisorySession;
        return {
          ...current,
          runInProgress: false,
          formalBoard: typed.formalBoard ? { ...typed.formalBoard, resumeLease: undefined } : typed.formalBoard,
        };
      });
      return NextResponse.json({ error: await runResponse.text() }, { status: 502 });
    }

    return NextResponse.json({ ok: true, leaseId, nextStep });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
