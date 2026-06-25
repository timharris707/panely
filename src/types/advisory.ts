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

export interface AdvisorySession {
  id: string;
  topic: string;
  title?: string;
  mode: "roundtable" | "competitive";
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
  competitiveVoteMode?: "agent-winner" | "top-ideas";
  competitiveTopCount?: number;
  agentModelOverrides?: Record<string, string>;
  agentPersonalityTraits?: Record<string, string[]>;
  agentCommunicationStyles?: Record<string, string>;
  agentIntensityLevels?: Record<string, number>;
  agentResponseLengths?: Record<string, string>;
  agentThinkingLevels?: Record<string, string>;
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
  mode: "roundtable" | "competitive";
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
  provenance: DecisionRecordProvenance[];
  transcriptMarkdown: string;
  markdown: string;
}

export interface BoardBrief {
  id: string;
  sessionId: string;
  title: string;
  topic: string;
  mode: "roundtable" | "competitive";
  status: "draft" | "complete";
  generatedAt: string;
  decision: string;
  recommendation: string;
  topIdeas: Array<{ idea: string; votes?: number; rank?: number }>;
  dissent: string[];
  risks: string[];
  actionItems: string[];
  modelProvenance: Array<{ agent: string; model?: string; status?: string; durationMs?: number }>;
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
  mode: "roundtable" | "competitive";
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
