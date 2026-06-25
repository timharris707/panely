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
  streaming?: boolean;
  error?: boolean;
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
  pitches: Record<string, string>;
  votes: VoteRecord[];
  winner: string | null;
  voteTally: Record<string, number>;
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
  agentModelOverrides?: Record<string, string>;
  agentPersonalityTraits?: Record<string, string[]>;
  agentCommunicationStyles?: Record<string, string>;
  agentIntensityLevels?: Record<string, number>;
  agentResponseLengths?: Record<string, string>;
  agentThinkingLevels?: Record<string, string>;
  moderator?: string;
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
