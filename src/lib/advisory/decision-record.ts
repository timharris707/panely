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

const LIST_MARKER_PATTERN = /^\s*(?:[-*]\s+|\d+[.)]\s+)/;

function cleanMarkdown(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

const FORMAL_SECTION_LABELS = new Set([
  "verdict",
  "formal board verdict",
  "evidence-backed",
  "evidence backed",
  "judgment calls",
  "judgment call",
  "could not verify",
  "minority report",
  "next actions",
  "next action",
  "open questions",
  "open question",
]);

function repairBrokenBold(value: string) {
  return value
    .replace(/^([^*#\n][^:\n]{2,180}):\*\*(\s*)/, "**$1:** ")
    .replace(/^([^*#\n]{2,180}?)\*\*(\s+[—-]\s+)/, "**$1**$2")
    .replace(/^([^*#\n]{2,180}?)\*\*(\s+)/, "**$1**$2");
}

function cleanFormalListItems(value: string[] | undefined) {
  return safeList(value)
    .map((item) =>
      repairBrokenBold(
        cleanMarkdown(item)
          .replace(LIST_MARKER_PATTERN, "")
          .replace(/^#{1,6}\s+/, "")
          .replace(/:\s*$/, "")
          .trim()
      )
    )
    .filter((item) => item && !FORMAL_SECTION_LABELS.has(item.toLowerCase()))
    .filter((item) => !/^(?:SHIP|CAUTION|BLOCK)\s*[:.]?\s*$/i.test(item));
}

function summarizeText(value: string, maxLength = 420) {
  const text = cleanMarkdown(value).replace(/\s+/g, " ");
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function cleanFormalSummary(value: string) {
  return cleanMarkdown(value)
    .replace(/^#{1,6}\s*Verdict\s*/i, "")
    .replace(/^(?:\*\*)?(SHIP|CAUTION|BLOCK)[.:]\s*(?:\*\*)?/i, "")
    .replace(/\s+/g, " ")
    .trim();
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
    .map((line) => line.replace(LIST_MARKER_PATTERN, "").trim())
    .filter((line) => !/^#{1,6}\s+/.test(line))
    .filter((line) => /action|next|owner|timeline|ship|implement|fix|add|create|verify/i.test(line))
    .slice(0, 8);
  const source = "session transcript";
  return (lines.length ? lines : ["Review the brief, confirm the top recommendation, and choose the next implementation step."])
    .map((title) => ({ title, source }));
}

function extractRisks(events: AdvisoryEvent[]) {
  return events
    .flatMap((event) => cleanMarkdown(event.text).split("\n"))
    .map((line) => line.replace(LIST_MARKER_PATTERN, "").trim())
    .filter((line) => !/^#{1,6}\s+/.test(line))
    .filter((line) => /risk|failure|failed|concern|blocker|unsafe|leak|timeout|stuck|missing/i.test(line))
    .slice(0, 8);
}

function extractOpenQuestions(events: AdvisoryEvent[]) {
  return events
    .flatMap((event) => cleanMarkdown(event.text).split("\n"))
    .map((line) => line.replace(LIST_MARKER_PATTERN, "").trim())
    .filter((line) => !/^#{1,6}\s+/.test(line))
    .filter((line) => /\?|open question|unknown|needs research|follow-up/i.test(line))
    .slice(0, 8);
}

function buildDecision(session: AdvisorySession, events: AdvisoryEvent[]) {
  if (session.mode === "formal-board" && session.formalBoard?.verdict) {
    const summary = cleanFormalSummary(session.formalBoard.verdict.summary);
    return `${session.formalBoard.verdict.verdict.toUpperCase()}: ${summary || session.formalBoard.verdict.verdict.toUpperCase()}`;
  }

  const finalEvent = [...events].reverse().find((event) => event.type === "complete" && event.text);
  if (finalEvent) return summarizeText(finalEvent.text, 900);

  if (session.mode === "competitive" && session.competitive?.topIdeas?.length) {
    return `Top ranked ideas: ${session.competitive.topIdeas.map((idea, index) => `${index + 1}. ${idea.idea}`).join("; ")}.`;
  }

  const lastContent = [...events].reverse().find((event) => event.text && event.type !== "start");
  return lastContent ? summarizeText(lastContent.text, 900) : "No decision was generated.";
}

function buildOptions(session: AdvisorySession): DecisionRecordOption[] {
  if (session.mode === "formal-board" && session.formalBoard?.verdict) {
    const verdict = session.formalBoard.verdict;
    return [
      {
        title: verdict.verdict.toUpperCase(),
        summary: cleanFormalSummary(verdict.summary) || verdict.summary,
        rank: 1,
      },
    ];
  }
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

function buildFormalDissent(session: AdvisorySession): DecisionRecordDissent[] {
  const dissent = session.formalBoard?.verdict?.dissent || [];
  return dissent.map((item) => ({
    agent: item.who,
    summary: normalizeArtifactText(item.body),
  })).filter((item) => item.summary).slice(0, 8);
}

function normalizeArtifactText(value: string) {
  return repairBrokenBold(
    cleanMarkdown(value)
      .replace(LIST_MARKER_PATTERN, "")
      .replace(/^#{1,6}\s+/, "")
      .trim()
  );
}

function buildFormalRisks(session: AdvisorySession) {
  const verdict = session.formalBoard?.verdict;
  if (!verdict) return [];
  const blockers = verdict.blockers.map((item) => normalizeArtifactText(item.body));
  const caveats = cleanFormalListItems(verdict.couldntVerify);
  return [...blockers, ...caveats].filter(Boolean).slice(0, 8);
}

function buildFormalOpenQuestions(session: AdvisorySession) {
  return cleanFormalListItems(session.formalBoard?.verdict?.open_questions).slice(0, 8);
}

function buildFormalActionItems(session: AdvisorySession): DecisionRecordActionItem[] {
  return cleanFormalListItems(session.formalBoard?.verdict?.next_actions)
    .map((title) => ({ title, source: "formal board verdict" }))
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

function safeList<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function renderDecisionRecordMarkdown(record: Omit<DecisionRecord, "markdown">) {
  const formalVerdict = record.formalVerdict;
  const formalSameSeatContinuity = safeList(formalVerdict?.sameSeatContinuity);
  const formalEvidenceBacked = cleanFormalListItems(formalVerdict?.evidenceBacked);
  const formalJudgmentCalls = cleanFormalListItems(formalVerdict?.judgmentCalls);
  const formalCouldntVerify = cleanFormalListItems(formalVerdict?.couldntVerify);
  const formalMinorityReport = cleanFormalListItems(formalVerdict?.minorityReport);
  return [
    `# ${record.title}`,
    "",
    `- **Session:** ${record.sessionId}`,
    `- **Mode:** ${record.mode}`,
    `- **Status:** ${record.status}`,
    `- **Generated:** ${record.generatedAt}`,
    `- **Topic:** ${record.topic}`,
    record.voteMode ? `- **Vote mode:** ${record.voteMode}${record.blindVote ? " (blind final vote)" : ""}` : "",
    formalVerdict ? `- **Formal verdict:** ${formalVerdict.verdict.toUpperCase()} (${formalVerdict.valid ? "valid" : "invalid"})` : "",
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
    formalVerdict ? "" : "",
    formalVerdict ? "## Formal Board Verdict" : "",
    formalVerdict ? "" : "",
    ...(formalVerdict
      ? [
          `- **Schema:** ${formalVerdict.schema}`,
          `- **Verdict:** ${formalVerdict.verdict.toUpperCase()}`,
          `- **Confidence:** ${formalVerdict.confidence || "unknown"}`,
          `- **Rounds:** ${formalVerdict.rounds || "unknown"}`,
          `- **Same-seat continuity:** ${formalSameSeatContinuity.length ? formalSameSeatContinuity.join(", ") : "none recorded"}`,
          `- **Synthesis:** ${formalVerdict.synthesisProducer || "unknown"}${formalVerdict.synthesisNeutrality ? ` (${formalVerdict.synthesisNeutrality})` : ""}`,
          `- **Valid:** ${formalVerdict.valid ? "yes" : "no"}`,
          ...(formalVerdict.validityReason ? [`- **Validity note:** ${formalVerdict.validityReason}`] : []),
          "",
          "### Evidence-backed",
          ...(formalEvidenceBacked.length ? formalEvidenceBacked.map((item) => `- ${item}`) : ["- None extracted."]),
          "",
          "### Judgment Calls",
          ...(formalJudgmentCalls.length ? formalJudgmentCalls.map((item) => `- ${item}`) : ["- None extracted."]),
          "",
          "### Could Not Verify",
          ...(formalCouldntVerify.length ? formalCouldntVerify.map((item) => `- ${item}`) : ["- None extracted."]),
          "",
          "### Minority Report",
          ...(formalMinorityReport.length ? formalMinorityReport.map((item) => `- ${item}`) : ["- No explicit minority report was extracted."]),
        ]
      : []),
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
  const formalDissent = session.mode === "formal-board" ? buildFormalDissent(session) : [];
  const formalRisks = session.mode === "formal-board" ? buildFormalRisks(session) : [];
  const formalOpenQuestions = session.mode === "formal-board" ? buildFormalOpenQuestions(session) : [];
  const formalActionItems = session.mode === "formal-board" ? buildFormalActionItems(session) : [];
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
    dissent: formalDissent.length ? formalDissent : buildDissent(events),
    risks: formalRisks.length ? formalRisks : extractRisks(events),
    openQuestions: formalOpenQuestions.length ? formalOpenQuestions : extractOpenQuestions(events),
    actionItems: formalActionItems.length ? formalActionItems : extractActionItems(events),
    voteMode: session.competitive?.voteMode,
    blindVote: session.mode === "competitive",
    voteTally: session.competitive?.voteTally,
    voteBreakdown: session.competitive?.votes,
    formalVerdict: session.formalBoard?.verdict,
    provenance: buildProvenance(session),
    transcriptMarkdown,
  };

  return {
    ...recordBase,
    markdown: renderDecisionRecordMarkdown(recordBase),
  };
}
