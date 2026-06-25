export interface VoteRecordLike {
  voter: string;
  votedFor: string;
  reasoning: string;
}

export interface TopIdeaResult {
  idea: string;
  votes: number;
  rank: number;
}

export function cleanIdeaVote(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/^[-*\d.)\s]+/, "")
    .replace(/[.。,:;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function normalizeIdeaVoteKey(value: string) {
  return cleanIdeaVote(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTopIdeaVotes(text: string, topCount: number) {
  const votes: string[] = [];
  const voteLinePattern = /^\s*\*{0,2}VOTE\s*(?:#?\s*)?([1-9])\s*:\s*(.+?)\*{0,2}\s*$/gim;
  let match: RegExpExecArray | null;
  while ((match = voteLinePattern.exec(text))) {
    const idea = cleanIdeaVote(match[2]);
    if (idea) votes.push(idea);
  }

  if (votes.length === 0) {
    const genericVoteLine = text.match(/^\s*\*{0,2}VOTE:\s*(.+?)\*{0,2}\s*$/im)?.[1];
    if (genericVoteLine) {
      for (const part of genericVoteLine.split(/\s*(?:;|\||\n)\s*/)) {
        const idea = cleanIdeaVote(part);
        if (idea) votes.push(idea);
      }
    }
  }

  return Array.from(new Set(votes)).slice(0, Math.max(1, topCount));
}

export function parseCompetitiveVote(text: string, voter: string, agents: string[]) {
  const voteLine =
    text.match(/^\s*\*{0,2}VOTE:\s*([^*\n\r]+)\*{0,2}/im)?.[1] ||
    text.match(/VOTE:\s*([^*\n\r]+)/i)?.[1] ||
    "";
  const cleanedVote = voteLine
    .replace(/\*\*/g, "")
    .replace(/[.。,:;]+$/g, "")
    .trim();
  if (!cleanedVote) return "Unknown";

  const eligibleAgents = agents.filter((candidate) => candidate !== voter);
  const exactMatch = eligibleAgents.find(
    (candidate) => candidate.toLowerCase() === cleanedVote.toLowerCase()
  );
  if (exactMatch) return exactMatch;

  const prefixMatch = eligibleAgents.find(
    (candidate) =>
      candidate.toLowerCase().startsWith(cleanedVote.toLowerCase()) ||
      cleanedVote.toLowerCase().startsWith(candidate.toLowerCase())
  );
  if (prefixMatch) return prefixMatch;

  return cleanedVote;
}

export function registerTopIdeaVote(voteTally: Record<string, number>, rawIdea: string) {
  const label = cleanIdeaVote(rawIdea);
  const key = normalizeIdeaVoteKey(label);
  if (!label || !key) return null;

  const existingLabel = Object.keys(voteTally).find(
    (candidate) => normalizeIdeaVoteKey(candidate) === key
  );
  const tallyLabel = existingLabel || label;
  voteTally[tallyLabel] = (voteTally[tallyLabel] || 0) + 1;
  return tallyLabel;
}

export function buildTopIdeasFromTally(voteTally: Record<string, number>, topCount: number): TopIdeaResult[] {
  return Object.entries(voteTally)
    .sort(([, a], [, b]) => b - a)
    .slice(0, Math.max(1, topCount))
    .map(([idea, votes], index) => ({ idea, votes, rank: index + 1 }));
}

export function selectWinner(voteTally: Record<string, number>, fallback: string) {
  const maxVotes = Math.max(...Object.values(voteTally), 0);
  const winner = Object.entries(voteTally).find(([, votes]) => votes === maxVotes)?.[0];
  return winner || fallback;
}

export function filterBlindVoteEvents<T extends { id?: string }>(events: T[]) {
  return events.filter((event) => !String(event.id || "").startsWith("evt_vote_"));
}
