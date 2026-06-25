import type {
  AdvisoryEvent,
  AdvisoryRunAttempt,
  AdvisorySession,
  DecisionRecord,
  DecisionRecordActionItem,
  DecisionRecordDissent,
  DecisionRecordOption,
  DecisionRecordProvenance,
} from "../../types/advisory.ts";
import { buildTopIdeasFromTally } from "./competitive.ts";
import { buildRequestedModelProvenance, formatModelProvenance } from "./provenance.ts";

function cleanMarkdown(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function summarizeText(value: string, maxLength = 420) {
  const text = cleanMarkdown(value).replace(/\s+/g, " ");
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function eventLabel(event: AdvisoryEvent) {
  const time = event.timestamp ? new Date(event.timestamp).toLocaleString() : "";
  const model = event.model ? ` · ${event.model}` : "";
  const duration = typeof event.durationMs === "number" ? ` · ${(event.durationMs / 1000).toFixed(1)}s` : "";
  return `### ${event.speaker}${model}${duration}${time ? ` · ${time}` : ""}`;
}

function buildTranscript(events: AdvisoryEvent[]) {
  return events.map((event) => `${eventLabel(event)}\n\n${cleanMarkdown(event.text) || "_No content recorded._"}`).join("\n\n");
}

function extractActionItems(events: AdvisoryEvent[]): DecisionRecordActionItem[] {
  const finalEvents = events.filter((event) => event.type === "complete" || /action|next step|timeline|owner/i.test(event.text));
  const lines = finalEvents
    .flatMap((event) => cleanMarkdown(event.text).split("\n"))
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((line) => /action|next|owner|timeline|ship|implement|fix|add|create|verify/i.test(line))
    .slice(0, 8);
  const source = "session transcript";
  return (lines.length ? lines : ["Review the brief, confirm the top recommendation, and choose the next implementation step."])
    .map((title) => ({ title, source }));
}

function extractRisks(events: AdvisoryEvent[]) {
  return events
    .flatMap((event) => cleanMarkdown(event.text).split("\n"))
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((line) => /risk|failure|failed|concern|blocker|unsafe|leak|timeout|stuck|missing/i.test(line))
    .slice(0, 8);
}

function extractOpenQuestions(events: AdvisoryEvent[]) {
  return events
    .flatMap((event) => cleanMarkdown(event.text).split("\n"))
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((line) => /\?|open question|unknown|needs research|follow-up/i.test(line))
    .slice(0, 8);
}

function buildDecision(session: AdvisorySession, events: AdvisoryEvent[]) {
  const finalEvent = [...events].reverse().find((event) => event.type === "complete" && event.text);
  if (finalEvent) return summarizeText(finalEvent.text, 900);

  if (session.mode === "competitive" && session.competitive?.topIdeas?.length) {
    return `Top ranked ideas: ${session.competitive.topIdeas.map((idea, index) => `${index + 1}. ${idea.idea}`).join("; ")}.`;
  }

  const lastContent = [...events].reverse().find((event) => event.text && event.type !== "start");
  return lastContent ? summarizeText(lastContent.text, 900) : "No decision was generated.";
}

function buildOptions(session: AdvisorySession): DecisionRecordOption[] {
  if (session.mode !== "competitive" || !session.competitive) return [];
  if (session.competitive.topIdeas?.length) {
    return session.competitive.topIdeas.map((idea, index) => ({
      title: idea.idea,
      summary: idea.idea,
      votes: idea.votes,
      rank: index + 1,
    }));
  }
  return buildTopIdeasFromTally(session.competitive.voteTally || {}, session.competitive.topCount || 3)
    .map((idea) => ({
      title: idea.idea,
      summary: idea.idea,
      votes: idea.votes,
      rank: idea.rank,
    }));
}

function buildDissent(events: AdvisoryEvent[]): DecisionRecordDissent[] {
  return events
    .filter((event) => event.error || /dissent|disagree|push back|minority|however|concern/i.test(event.text))
    .map((event) => ({
      agent: event.speaker,
      summary: summarizeText(event.text, 300),
      model: event.model,
      phase: event.phase,
    }))
    .slice(0, 8);
}

function buildProvenance(session: AdvisorySession): DecisionRecordProvenance[] {
  const attempts = Array.isArray(session.runAttempts) ? session.runAttempts : [];
  if (attempts.length) {
    return attempts.map((attempt: AdvisoryRunAttempt) => ({
      agent: attempt.agentId,
      model: attempt.modelSource || attempt.model,
      status: attempt.status,
      durationMs: attempt.durationMs,
      provenance: buildRequestedModelProvenance(attempt.model, attempt.modelSource),
    }));
  }

  return (session.events || [])
    .filter((event) => event.model)
    .map((event) => ({
      agent: event.speaker,
      model: event.model,
      status: event.error ? "failed" : "succeeded",
      durationMs: event.durationMs,
      provenance: event.provenance || buildRequestedModelProvenance(event.model, event.modelSource),
    }));
}

export function renderDecisionRecordMarkdown(record: Omit<DecisionRecord, "markdown">) {
  return [
    `# ${record.title}`,
    "",
    `- **Session:** ${record.sessionId}`,
    `- **Mode:** ${record.mode}`,
    `- **Status:** ${record.status}`,
    `- **Generated:** ${record.generatedAt}`,
    `- **Topic:** ${record.topic}`,
    record.voteMode ? `- **Vote mode:** ${record.voteMode}${record.blindVote ? " (blind final vote)" : ""}` : "",
    "",
    "## Decision",
    "",
    record.decision,
    "",
    "## Recommendation",
    "",
    record.recommendation,
    "",
    "## Options Considered",
    "",
    ...(record.optionsConsidered.length
      ? record.optionsConsidered.map((option) => `${option.rank || "- "}. ${option.title}${typeof option.votes === "number" ? ` (${option.votes} votes)` : ""}`)
      : ["No ranked options were recorded."]),
    "",
    "## Dissent and Caveats",
    "",
    ...(record.dissent.length ? record.dissent.map((item) => `- ${item.agent}: ${item.summary}`) : ["- No explicit dissent was recorded."]),
    "",
    "## Risks",
    "",
    ...(record.risks.length ? record.risks.map((item) => `- ${item}`) : ["- No explicit risks were extracted."]),
    "",
    "## Open Questions",
    "",
    ...(record.openQuestions.length ? record.openQuestions.map((item) => `- ${item}`) : ["- No open questions were extracted."]),
    "",
    "## Action Items",
    "",
    ...record.actionItems.map((item) => `- ${item.owner ? `${item.owner}: ` : ""}${item.title}`),
    "",
    "## Model Provenance",
    "",
    ...(record.provenance.length
      ? record.provenance.map((item) => `- ${item.agent}: ${item.model || "unknown"} · ${item.status || "unknown"}${typeof item.durationMs === "number" ? ` · ${(item.durationMs / 1000).toFixed(1)}s` : ""}\n  - ${formatModelProvenance(item.provenance)}`)
      : ["- No model provenance was recorded."]),
    "",
    "## Full Transcript",
    "",
    record.transcriptMarkdown,
    "",
  ].filter(Boolean).join("\n");
}

export function buildDecisionRecord(session: AdvisorySession): DecisionRecord {
  const events = session.events || [];
  const optionsConsidered = buildOptions(session);
  const decision = buildDecision(session, events);
  const recommendation = optionsConsidered[0]?.title || decision;
  const generatedAt = new Date().toISOString();
  const title = session.title || session.topic.slice(0, 90);
  const transcriptMarkdown = buildTranscript(events);
  const recordBase: Omit<DecisionRecord, "markdown"> = {
    id: `decision-${session.id}`,
    sessionId: session.id,
    title,
    topic: session.topic,
    mode: session.mode,
    status: session.status === "completed" ? "complete" : "draft",
    generatedAt,
    recommendation,
    decision,
    optionsConsidered,
    dissent: buildDissent(events),
    risks: extractRisks(events),
    openQuestions: extractOpenQuestions(events),
    actionItems: extractActionItems(events),
    voteMode: session.competitive?.voteMode,
    blindVote: session.mode === "competitive",
    voteTally: session.competitive?.voteTally,
    voteBreakdown: session.competitive?.votes,
    provenance: buildProvenance(session),
    transcriptMarkdown,
  };

  return {
    ...recordBase,
    markdown: renderDecisionRecordMarkdown(recordBase),
  };
}
