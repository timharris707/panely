// ─── Advisory Board Types ────────────────────────────────────────────────────

export interface AdvisoryEvent {
  id: string;
  timestamp: string;
  updatedAt?: string;
  type: string;
  speaker: string;
  emoji: string;
  role: "worker" | "supervisor" | "reviewer" | "moderator" | "system";
  text: string;
  verdict?: string;
  model?: string;
  modelSource?: string;
  provenance?: AdvisoryModelProvenance;
  streaming?: boolean;
  error?: boolean;
  errorKind?: string;
  durationMs?: number;
  attemptId?: string;
  phase?: string;
}

export interface ActionItem {
  description: string;
  assignedAgent: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "done";
}

export interface DetailedActionItem {
  id: string;
  title: string;
  description: string;
  assignedAgent: string;
  suggestedDeadline: string;
  priority: "high" | "medium" | "low";
  source: string;
  status: "pending" | "pushed" | "skipped";
}

export interface SessionInsights {
  actionItems: ActionItem[];
  keyDecisions: string[];
  openQuestions: string[];
  risksIdentified: string[];
  extractedAt: string;
}

export interface VoteRecord {
  voter: string;
  votedFor: string;
  reasoning: string;
}

export type AdvisorySessionMode = "roundtable" | "competitive" | "formal-board";
export type FormalBoardPhase = "preflight" | "round-1" | "round-2" | "round-3" | "synthesis" | "complete";
export type FormalBoardSeatStatus = "pending" | "ran" | "degraded" | "dropped";

export interface CompetitiveState {
  phase: "pitch" | "critique" | "vote" | "complete";
  voteMode?: "agent-winner" | "top-ideas";
  topCount?: number;
  pitches: Record<string, string>;
  votes: VoteRecord[];
  winner: string | null;
  voteTally: Record<string, number>;
  topIdeas?: Array<{ idea: string; votes: number }>;
}

export interface FormalBoardSeat {
  agentId: string;
  role?: string;
  model?: string;
  status: FormalBoardSeatStatus;
  statusReason?: string;
  roundsCompleted: number;
}

export interface FormalBoardRoundArtifact {
  round: 1 | 2 | 3;
  agentId: string;
  status: FormalBoardSeatStatus;
  text: string;
  model?: string;
  attemptId?: string;
  errorKind?: string;
  generatedAt: string;
}

export interface FormalBoardVerdict {
  schema: "advisory-board/verdict@1";
  title: string;
  date: string;
  verdict: "ship" | "caution" | "block";
  confidence: "low" | "medium" | "high";
  unanimous: boolean;
  rounds: number;
  board: Array<{
    seat: string;
    model: string;
    lens?: string;
    round_verdicts: Array<"ship" | "caution" | "block">;
    dropped: boolean;
    verdictsEstimated?: boolean;
  }>;
  blockers: Array<{ title: string; body: string }>;
  dissent: Array<{ who: string; body: string }>;
  open_questions: string[];
  next_actions: string[];
  summary: string;
  evidenceBacked: string[];
  judgmentCalls: string[];
  couldntVerify: string[];
  minorityReport: string[];
  droppedSeats: Array<{ agentId: string; reason?: string }>;
  degradedSeats: Array<{ agentId: string; reason?: string }>;
  valid: boolean;
  validityReason?: string;
  sameSeatContinuity: string[];
  synthesisNeutrality?: "neutral-clerk" | "model-reused" | "seat-authored";
  synthesisProducer?: string;
}

export interface FormalBoardState {
  protocol: "advisory-board/formal@1";
  phase: FormalBoardPhase;
  sourcePacketHash: string;
  sourcePacketPreview: string;
  artifactDir?: string;
  seats: FormalBoardSeat[];
  rounds: FormalBoardRoundArtifact[];
  verdict?: FormalBoardVerdict;
}

export interface AdvisorySession {
  id: string;
  topic: string;
  title?: string;
  mode: AdvisorySessionMode;
  agents: string[];
  status: "active" | "completed" | "abandoned";
  createdAt: string;
  completedAt?: string;
  archived?: boolean;
  archivedAt?: string;
  transcriptPath?: string;
  outcome?: string;
  model?: string;
  rounds?: number | "persistent";
  pacing?: string;
  paused?: boolean;
  runInProgress?: boolean;
  eventCount?: number;
  lastEvent?: AdvisoryEvent | null;
  events?: AdvisoryEvent[];
  lastError?: string;
  insights?: SessionInsights | null;
  referenceContext?: string;
  referenceContextBudgetChars?: number;
  competitive?: CompetitiveState | null;
  formalBoard?: FormalBoardState | null;
  competitiveVoteMode?: "agent-winner" | "top-ideas";
  competitiveTopCount?: number;
  agentModelOverrides?: Record<string, string>;
  agentPersonalityTraits?: Record<string, string[]>;
  agentCommunicationStyles?: Record<string, string>;
  agentIntensityLevels?: Record<string, number>;
  agentResponseLengths?: Record<string, string>;
  agentThinkingLevels?: Record<string, string>;
  providerDisclosure?: {
    accepted: boolean;
    acceptedAt?: string;
    sensitivity: "public" | "unknown" | "non-public";
    providers: string[];
    message: string;
  };
  moderator?: string;
  modelHealthSnapshot?: unknown;
  runAttempts?: AdvisoryRunAttempt[];
  brief?: BoardBrief;
  decisionRecord?: DecisionRecord;
  runSteps?: AdvisoryRunStep[];
}

export interface AdvisoryRunAttempt {
  id: string;
  phase: string;
  agentId: string;
  model: string;
  modelSource?: string;
  status: "running" | "succeeded" | "failed";
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  attempt: number;
  errorKind?: string;
  error?: string;
}

export interface AdvisoryModelProvenance {
  requestedModelId: string;
  requestedModel: string;
  requestedProvider: string;
  localCli?: string;
  routedModel?: string;
  observedModel?: string;
  verificationStatus: "requested-only" | "reported-by-cli" | "unknown";
  note: string;
}

export interface AdvisoryRunStep {
  id: string;
  sessionId: string;
  index: number;
  phase: string;
  agentId: string;
  model: string;
  status: "queued" | "running" | "done" | "failed" | "stale";
  attemptId?: string;
  startedAt?: string;
  heartbeatAt?: string;
  completedAt?: string;
  errorKind?: string;
  error?: string;
  provenance?: AdvisoryModelProvenance;
}

export interface DecisionRecordOption {
  title: string;
  summary: string;
  votes?: number;
  rank?: number;
  sourceAgent?: string;
}

export interface DecisionRecordDissent {
  agent: string;
  summary: string;
  model?: string;
  phase?: string;
}

export interface DecisionRecordActionItem {
  title: string;
  owner?: string;
  priority?: "high" | "medium" | "low";
  source?: string;
}

export interface DecisionRecordProvenance {
  agent: string;
  model?: string;
  status?: string;
  durationMs?: number;
  provenance?: AdvisoryModelProvenance;
}

export interface DecisionRecord {
  id: string;
  sessionId: string;
  title: string;
  topic: string;
  mode: AdvisorySessionMode;
  status: "draft" | "complete";
  generatedAt: string;
  recommendation: string;
  decision: string;
  optionsConsidered: DecisionRecordOption[];
  dissent: DecisionRecordDissent[];
  risks: string[];
  openQuestions: string[];
  actionItems: DecisionRecordActionItem[];
  voteMode?: "agent-winner" | "top-ideas";
  blindVote?: boolean;
  voteTally?: Record<string, number>;
  voteBreakdown?: VoteRecord[];
  formalVerdict?: FormalBoardVerdict;
  provenance: DecisionRecordProvenance[];
  transcriptMarkdown: string;
  markdown: string;
}

export interface BoardBrief {
  id: string;
  sessionId: string;
  title: string;
  topic: string;
  mode: AdvisorySessionMode;
  status: "draft" | "complete";
  generatedAt: string;
  decision: string;
  recommendation: string;
  topIdeas: Array<{ idea: string; votes?: number; rank?: number }>;
  dissent: string[];
  risks: string[];
  actionItems: string[];
  modelProvenance: Array<{ agent: string; model?: string; status?: string; durationMs?: number }>;
  formalVerdict?: FormalBoardVerdict;
  markdown: string;
}

export interface CustomAgent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  persona: string;
  division: string;
  createdAt: string;
}

export interface SessionTemplate {
  id: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  mode: AdvisorySessionMode;
  agents: string[];
  responseLength: "concise" | "balanced" | "detailed" | "verbose";
  rounds: number;
  topic?: string;
}

export interface AgentDef {
  id: string;
  emoji: string;
  role: string;
  defaultRole: string;
}

export interface PersonaOverlay {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  relevantAgents: string[];
}

export interface ModelOption {
  id: string;
  label: string;
  desc: string;
}

export interface PacingOption {
  id: string;
  label: string;
  desc: string;
}
