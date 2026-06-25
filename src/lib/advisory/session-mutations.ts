import type { AdvisoryEvent } from "../../types/advisory";
import { getAdvisorySession, saveAdvisorySession, type AdvisorySessionRecord } from "../advisory-session-store";
import { withSessionLock } from "../session-lock";

export async function updateSessionLocked(
  sessionId: string,
  updater: (session: AdvisorySessionRecord) => AdvisorySessionRecord | void | Promise<AdvisorySessionRecord | void>
) {
  return withSessionLock(sessionId, async () => {
    const session = getAdvisorySession(sessionId);
    if (!session) return null;
    const updated = (await updater(session)) || session;
    return saveAdvisorySession(updated);
  });
}

export async function appendEventLocked(sessionId: string, event: AdvisoryEvent) {
  return updateSessionLocked(sessionId, (session) => {
    const events = Array.isArray(session.events) ? session.events : [];
    return {
      ...session,
      events: [...events, event],
    };
  });
}
