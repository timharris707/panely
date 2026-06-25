import type { AdvisorySession, BoardBrief } from "@/types/advisory";
import { buildDecisionRecord } from "@/lib/advisory/decision-record";

export function buildBoardBrief(session: AdvisorySession): BoardBrief {
  const decisionRecord = buildDecisionRecord(session);

  return {
    id: `brief-${session.id}`,
    sessionId: session.id,
    title: decisionRecord.title,
    topic: decisionRecord.topic,
    mode: decisionRecord.mode,
    status: decisionRecord.status,
    generatedAt: decisionRecord.generatedAt,
    decision: decisionRecord.decision,
    recommendation: decisionRecord.recommendation,
    topIdeas: decisionRecord.optionsConsidered.map((option) => ({
      idea: option.title,
      votes: option.votes,
      rank: option.rank,
    })),
    dissent: decisionRecord.dissent.map((item) => `${item.agent}: ${item.summary}`),
    risks: decisionRecord.risks,
    actionItems: decisionRecord.actionItems.map((item) => item.owner ? `${item.owner}: ${item.title}` : item.title),
    modelProvenance: decisionRecord.provenance.map((item) => ({
      agent: item.agent,
      model: item.model,
      status: item.status,
      durationMs: item.durationMs,
    })),
    markdown: decisionRecord.markdown,
  };
}
