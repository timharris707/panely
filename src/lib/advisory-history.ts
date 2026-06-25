/**
 * advisory-history.ts — Shared history builder with token-safe truncation.
 *
 * Used across all advisory API routes to build the discussion history string
 * injected into agent prompts. Caps output to prevent token explosion (C-3).
 */

const MAX_HISTORY_CHARS = 16000; // ~4000 tokens

interface HistoryEvent {
  speaker: string;
  text: string;
  type: string;
}

/**
 * Build a formatted discussion history string from session events.
 * Truncates from the beginning to stay under MAX_HISTORY_CHARS,
 * keeping the most recent events for context relevance.
 */
export function buildHistoryString(events: HistoryEvent[]): string {
  const relevant = events.filter(
    (e) => e.type !== "start" && e.type !== "complete" && e.text
  );
  if (relevant.length === 0) return "No prior discussion yet.";

  const formatted = relevant.map((e) => {
    if (e.type === "human-directive" || e.speaker === "the user") {
      return `**User:** ${e.text.replace(/\*\*/g, "")}\n(The user is the human decision-maker — treat them as the most senior person in the room.)`;
    }
    return `**${e.speaker}:** ${e.text.replace(/\*\*/g, "")}`;
  });

  // Join and check length
  let result = formatted.join("\n\n");

  if (result.length > MAX_HISTORY_CHARS) {
    // Truncate from the beginning, keeping most recent events
    // Walk backwards to find how many entries fit
    let totalLen = 0;
    let startIdx = formatted.length;
    for (let i = formatted.length - 1; i >= 0; i--) {
      const entryLen = formatted[i].length + 2; // +2 for \n\n separator
      if (totalLen + entryLen > MAX_HISTORY_CHARS - 60) break; // reserve space for marker
      totalLen += entryLen;
      startIdx = i;
    }
    const kept = formatted.slice(startIdx);
    result = `[...earlier discussion truncated — ${startIdx} prior message(s) omitted...]\n\n${kept.join("\n\n")}`;
  }

  return result;
}
