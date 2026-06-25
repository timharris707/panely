import type { AdvisoryEvent, AdvisoryRunAttempt, AdvisorySession, BoardBrief } from "@/types/advisory";

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

function extractActionItems(events: AdvisoryEvent[]) {
  const finalEvents = events.filter((event) => event.type === "complete" || /action|next step|timeline|owner/i.test(event.text));
  const lines = finalEvents
    .flatMap((event) => cleanMarkdown(event.text).split("\n"))
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((line) => /action|next|owner|timeline|ship|implement|fix|add|create|verify/i.test(line))
    .slice(0, 8);
  return lines.length ? lines : ["Review the brief, confirm the top recommendation, and choose the next implementation step."];
}

function extractRisks(events: AdvisoryEvent[]) {
  const risks = events
    .flatMap((event) => cleanMarkdown(event.text).split("\n"))
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((line) => /risk|failure|failed|concern|blocker|unsafe|leak|timeout|stuck|missing/i.test(line))
    .slice(0, 8);
  return risks.length ? risks : [];
}

function buildDecision(session: AdvisorySession, events: AdvisoryEvent[]) {
  const finalEvent = [...events].reverse().find((event) => event.type === "complete" && event.text);
  if (finalEvent) return summarizeText(finalEvent.text, 800);

  if (session.mode === "competitive" && session.competitive?.topIdeas?.length) {
    return `Top ranked ideas: ${session.competitive.topIdeas.map((idea, index) => `${index + 1}. ${idea.idea}`).join("; ")}.`;
  }

  const lastContent = [...events].reverse().find((event) => event.text && event.type !== "start");
  return lastContent ? summarizeText(lastContent.text, 800) : "No decision was generated.";
}

function buildTopIdeas(session: AdvisorySession) {
  if (session.mode !== "competitive" || !session.competitive) return [];
  if (session.competitive.topIdeas?.length) {
    return session.competitive.topIdeas.map((idea, index) => ({ idea: idea.idea, votes: idea.votes, rank: index + 1 }));
  }
  return Object.entries(session.competitive.voteTally || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, session.competitive.topCount || 3)
    .map(([idea, votes], index) => ({ idea, votes, rank: index + 1 }));
}

function buildDissent(events: AdvisoryEvent[]) {
  const dissent = events
    .filter((event) => event.error || /dissent|disagree|push back|minority|however|concern/i.test(event.text))
    .map((event) => `${event.speaker}: ${summarizeText(event.text, 260)}`)
    .slice(0, 8);
  return dissent;
}

function buildModelProvenance(session: AdvisorySession) {
  const attempts = Array.isArray(session.runAttempts) ? session.runAttempts : [];
  if (attempts.length) {
    return attempts.map((attempt: AdvisoryRunAttempt) => ({
      agent: attempt.agentId,
      model: attempt.modelSource || attempt.model,
      status: attempt.status,
      durationMs: attempt.durationMs,
    }));
  }
  return (session.events || [])
    .filter((event) => event.model)
    .map((event) => ({
      agent: event.speaker,
      model: event.model,
      status: event.error ? "failed" : "succeeded",
      durationMs: event.durationMs,
    }));
}

export function buildBoardBrief(session: AdvisorySession): BoardBrief {
  const events = session.events || [];
  const topIdeas = buildTopIdeas(session);
  const decision = buildDecision(session, events);
  const recommendation = topIdeas[0]?.idea || decision;
  const dissent = buildDissent(events);
  const risks = extractRisks(events);
  const actionItems = extractActionItems(events);
  const modelProvenance = buildModelProvenance(session);
  const title = session.title || session.topic.slice(0, 90);
  const generatedAt = new Date().toISOString();
  const briefId = `brief-${session.id}`;

  const markdown = [
    `# ${title}`,
    "",
    `- **Session:** ${session.id}`,
    `- **Mode:** ${session.mode}`,
    `- **Status:** ${session.status}`,
    `- **Generated:** ${generatedAt}`,
    `- **Topic:** ${session.topic}`,
    "",
    "## Decision",
    "",
    decision,
    "",
    "## Recommendation",
    "",
    recommendation,
    "",
    "## Top Ideas",
    "",
    ...(topIdeas.length
      ? topIdeas.map((idea) => `${idea.rank || "- "}. ${idea.idea}${typeof idea.votes === "number" ? ` (${idea.votes} votes)` : ""}`)
      : ["No ranked ideas were recorded."]),
    "",
    "## Dissent and Caveats",
    "",
    ...(dissent.length ? dissent.map((item) => `- ${item}`) : ["- No explicit dissent was recorded."]),
    "",
    "## Risks",
    "",
    ...(risks.length ? risks.map((item) => `- ${item}`) : ["- No explicit risks were extracted."]),
    "",
    "## Action Items",
    "",
    ...actionItems.map((item) => `- ${item}`),
    "",
    "## Model Provenance",
    "",
    ...(modelProvenance.length
      ? modelProvenance.map((item) => `- ${item.agent}: ${item.model || "unknown"} · ${item.status || "unknown"}${typeof item.durationMs === "number" ? ` · ${(item.durationMs / 1000).toFixed(1)}s` : ""}`)
      : ["- No model provenance was recorded."]),
    "",
    "## Full Transcript",
    "",
    ...events.map((event) => `${eventLabel(event)}\n\n${cleanMarkdown(event.text) || "_No content recorded._"}`),
    "",
  ].join("\n");

  return {
    id: briefId,
    sessionId: session.id,
    title,
    topic: session.topic,
    mode: session.mode,
    status: session.status === "completed" ? "complete" : "draft",
    generatedAt,
    decision,
    recommendation,
    topIdeas,
    dissent,
    risks,
    actionItems,
    modelProvenance,
    markdown,
  };
}
