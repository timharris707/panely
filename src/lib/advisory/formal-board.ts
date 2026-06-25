import type {
  FormalBoardRoundArtifact,
  FormalBoardSeat,
  FormalBoardSeatStatus,
  FormalBoardState,
  FormalBoardVerdict,
} from "../../types/advisory.ts";
import type { SourcePacket } from "./source-packet.ts";

const PROTOCOL_VERSION = "advisory-board/formal@1" as const;
const VERDICT_SCHEMA = "advisory-board/verdict@1" as const;

function normalizeLines(text: string, matcher: RegExp, maxItems = 8) {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((line) => line && matcher.test(line))
    .slice(0, maxItems);
}

function summarize(value: string, maxLength = 900) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function parseExplicitVerdict(text: string): FormalBoardVerdict["verdict"] {
  const verdictSection = text.match(/(?:^|\n)##\s*Verdict\s*\n([\s\S]*?)(?=\n##\s+|$)/i)?.[1] ?? text.slice(0, 500);
  const firstVerdict = verdictSection.match(/\b(SHIP|CAUTION|BLOCK)\b/i)?.[1]?.toLowerCase();
  return firstVerdict === "ship" || firstVerdict === "caution" || firstVerdict === "block"
    ? firstVerdict
    : "caution";
}

export function createFormalBoardState(input: {
  sessionId: string;
  agents: string[];
  agentRoles?: Record<string, string>;
  agentModels?: Record<string, string>;
  sourcePacket: SourcePacket;
}): FormalBoardState {
  return {
    protocol: PROTOCOL_VERSION,
    phase: "preflight",
    sourcePacketHash: input.sourcePacket.hash,
    sourcePacketPreview: input.sourcePacket.preview,
    artifactDir: `data/advisory/formal-runs/${input.sessionId}`,
    seats: input.agents.map((agentId) => ({
      agentId,
      role: input.agentRoles?.[agentId],
      model: input.agentModels?.[agentId],
      status: "pending",
      roundsCompleted: 0,
    })),
    rounds: [],
  };
}

export function countRunnableFormalSeats(state: Pick<FormalBoardState, "seats">) {
  return state.seats.filter((seat) => seat.status !== "dropped").length;
}

export function canRunFormalBoard(state: Pick<FormalBoardState, "seats">) {
  return countRunnableFormalSeats(state) >= 2;
}

export function setFormalBoardPhase(state: FormalBoardState, phase: FormalBoardState["phase"]): FormalBoardState {
  return { ...state, phase };
}

export function recordFormalRoundArtifact(
  state: FormalBoardState,
  artifact: Omit<FormalBoardRoundArtifact, "generatedAt">
): FormalBoardState {
  const generatedAt = new Date().toISOString();
  const rounds = [...state.rounds, { ...artifact, generatedAt }];
  const seats = state.seats.map((seat) => {
    if (seat.agentId !== artifact.agentId) return seat;
    const roundsCompleted = artifact.status === "ran"
      ? Math.max(seat.roundsCompleted, artifact.round)
      : seat.roundsCompleted;
    return {
      ...seat,
      status: artifact.status,
      statusReason: artifact.errorKind || seat.statusReason,
      roundsCompleted,
      model: artifact.model || seat.model,
    };
  });

  return { ...state, rounds, seats };
}

export function markFormalSeat(
  state: FormalBoardState,
  agentId: string,
  status: FormalBoardSeatStatus,
  reason?: string
): FormalBoardState {
  return {
    ...state,
    seats: state.seats.map((seat) =>
      seat.agentId === agentId ? { ...seat, status, statusReason: reason } : seat
    ),
  };
}

export function buildFormalRoundOneSystemPrompt(input: { agentName: string; role?: string; responseInstruction: string }) {
  return `You are ${input.agentName}, serving as ${input.role || "an independent formal board reviewer"}.

You are participating in a Formal Board Review using the advisory-board/formal@1 protocol.

Round 1 is independent. You must review only the source packet and your assigned role. You must not infer or quote other reviewers because you have not seen their work.

Return:
1. Independent finding
2. Evidence-backed observations
3. Judgment calls and assumptions
4. Risks or blockers
5. What you could not verify

${input.responseInstruction}`;
}

export function buildFormalRoundOneUserPrompt(sourcePacket: SourcePacket) {
  return `Review this exact source packet independently.

Source packet SHA-256: ${sourcePacket.hash}

${sourcePacket.text}`;
}

export function buildFormalRoundTwoSystemPrompt(input: { agentName: string; role?: string; responseInstruction: string }) {
  return `You are ${input.agentName}, serving as ${input.role || "a formal board reviewer"}.

Round 2 is rebuttal. You may now read the Round 1 packet from the other reviewers, challenge weak claims, defend strong claims, and update your position.

Return:
1. What changed after reading the board
2. Strongest agreement
3. Strongest disagreement or minority concern
4. Evidence/judgment/could-not-verify split
5. Your final verdict: SHIP, CAUTION, or BLOCK

${input.responseInstruction}`;
}

export function buildFormalRoundTwoUserPrompt(input: { topic: string; sourcePacketHash: string; roundOneArtifacts: FormalBoardRoundArtifact[] }) {
  const boardPacket = input.roundOneArtifacts
    .filter((artifact) => artifact.status === "ran")
    .map((artifact) => `## ${artifact.agentId}\n${artifact.text}`)
    .join("\n\n---\n\n");

  return `Topic: ${input.topic}

Source packet SHA-256: ${input.sourcePacketHash}

Round 1 board packet:

${boardPacket || "No successful Round 1 outputs were recorded."}`;
}

export function buildFormalSynthesisPrompt(input: { topic: string; sourcePacketHash: string; artifacts: FormalBoardRoundArtifact[]; seats: FormalBoardSeat[] }) {
  const outputs = input.artifacts
    .map((artifact) => `## Round ${artifact.round}: ${artifact.agentId} (${artifact.status})\n${artifact.text}`)
    .join("\n\n---\n\n");
  const seatStatus = input.seats
    .map((seat) => `- ${seat.agentId}: ${seat.status}${seat.statusReason ? ` (${seat.statusReason})` : ""}`)
    .join("\n");

  return `Create the final Formal Board Review synthesis.

Topic: ${input.topic}
Source packet SHA-256: ${input.sourcePacketHash}

Seat status:
${seatStatus}

Board outputs:
${outputs}

Return concise markdown with these exact headings:
## Verdict
Use SHIP, CAUTION, or BLOCK and one paragraph.

## Evidence-backed
Bullets only.

## Judgment calls
Bullets only.

## Could not verify
Bullets only.

## Minority report
Bullets only. Include meaningful dissent even if the majority agrees.

## Next actions
Bullets only.`;
}

export function buildFormalVerdict(input: {
  topic: string;
  synthesisText: string;
  state: FormalBoardState;
}): FormalBoardVerdict {
  const text = input.synthesisText;
  const verdict = parseExplicitVerdict(text);
  const droppedSeats = input.state.seats
    .filter((seat) => seat.status === "dropped")
    .map((seat) => ({ agentId: seat.agentId, reason: seat.statusReason }));
  const degradedSeats = input.state.seats
    .filter((seat) => seat.status === "degraded")
    .map((seat) => ({ agentId: seat.agentId, reason: seat.statusReason }));
  const successfulRoundOneSeats = new Set(input.state.rounds.filter((artifact) => artifact.round === 1 && artifact.status === "ran").map((artifact) => artifact.agentId));
  const successfulRoundTwoSeats = new Set(input.state.rounds.filter((artifact) => artifact.round === 2 && artifact.status === "ran").map((artifact) => artifact.agentId));
  const valid = successfulRoundOneSeats.size >= 2 && successfulRoundTwoSeats.size >= 2;

  return {
    schema: VERDICT_SCHEMA,
    verdict,
    summary: summarize(text),
    evidenceBacked: normalizeLines(text, /evidence|verified|shows|observed|because|source|sha|data/i),
    judgmentCalls: normalizeLines(text, /judgment|assume|likely|should|recommend|trade[- ]?off|opinion/i),
    couldntVerify: normalizeLines(text, /could not verify|couldn't verify|unknown|unclear|missing|not provided/i),
    minorityReport: normalizeLines(text, /minority|dissent|disagree|push back|concern|however/i),
    droppedSeats,
    degradedSeats,
    valid,
    validityReason: valid ? undefined : "A valid Formal Board Review requires at least two seats to complete independent Round 1 and rebuttal Round 2.",
  };
}
