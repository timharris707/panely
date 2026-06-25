"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Paperclip,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { AdvisorySession, CustomAgent } from "@/types/advisory";
import { MODELS, PACING_OPTIONS } from "./constants";
import { PROVIDERS, type ProviderModel } from "@/lib/ai/providers";
import { supportedThinkingLevels } from "@/lib/ai/thinking-levels";
import { buildProviderDisclosure } from "@/lib/advisory/provider-disclosure";
import { inferAdvisoryIntent, type AdvisoryIntent } from "@/lib/advisory/session-intent";

type Intent = AdvisoryIntent;
type SessionMode = "roundtable" | "competitive" | "formal-board";
type Stance = "balanced" | "adversarial" | "optimistic" | "skeptical";
type OutputPerspective = "decision-memo" | "action-plan" | "risk-memo" | "board-brief";
type ResponseLength = "concise" | "balanced" | "detailed" | "verbose";
type ThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

type LocalToolStatus = {
  available: boolean;
  version?: string;
};

type LocalModelStatus = {
  id: string;
  name: string;
  provider: string;
  model: string;
  thinkingLevels?: ThinkingLevel[];
  thinkingEnforced?: boolean;
  thinkingNote?: string;
  thinkingEvidence?: string;
  thinkingCapabilityCheckedAt?: string;
  contextWindow?: number;
  contextWindowSource?: "verified" | "configured" | "not-reported";
  contextEvidence?: string;
  contextNote?: string;
  probe?: {
    ok: boolean;
    status: string;
    error?: string;
  };
};

type PlannedLens = {
  id: string;
  name: string;
  role: string;
  purpose: string;
  modelId: string;
  thinkingLevel: ThinkingLevel;
  stance: string;
};

type AttachedFile = {
  id: string;
  name: string;
  size: number;
  text: string;
};

type ProjectContextPreview = {
  projectLabel: string;
  rootName: string;
  selectedFiles: Array<{
    path: string;
    size: number;
    score: number;
    reasons: string[];
    truncated: boolean;
    includedChars: number;
  }>;
  candidateFileCount: number;
  scannedDirCount: number;
  skippedFileCount: number;
  skippedDirCount: number;
  warnings: Array<{ code: string; message: string; path?: string }>;
  referenceContext: string;
  referenceContextChars: number;
  budgetChars: number;
  truncated: boolean;
};

interface LaunchWizardProps {
  onClose: () => void;
  onLaunch: (session: AdvisorySession) => void;
  customAgents?: CustomAgent[];
  onCustomAgentsChange?: () => void;
  onDeepDive?: (agentId: string, agentName: string, agentEmoji: string, agentRole: string) => void;
}

const STANCES: Array<{ id: Stance; label: string }> = [
  { id: "balanced", label: "Balanced" },
  { id: "adversarial", label: "Adversarial" },
  { id: "optimistic", label: "Opportunity" },
  { id: "skeptical", label: "Skeptical" },
];

const OUTPUTS: Array<{ id: OutputPerspective; label: string }> = [
  { id: "decision-memo", label: "Decision memo" },
  { id: "action-plan", label: "Action plan" },
  { id: "risk-memo", label: "Risk memo" },
  { id: "board-brief", label: "Board brief" },
];

const RESPONSE_LENGTHS: Array<{ id: ResponseLength; label: string; desc: string }> = [
  { id: "concise", label: "Concise", desc: "Shorter turns." },
  { id: "balanced", label: "Balanced", desc: "Useful depth without dragging." },
  { id: "detailed", label: "Detailed", desc: "More reasoning and trade-offs." },
  { id: "verbose", label: "Deep", desc: "Long-form analysis." },
];

const THINKING_LEVELS: Array<{ id: ThinkingLevel; label: string }> = [
  { id: "minimal", label: "Minimal" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "xhigh", label: "Extra high" },
  { id: "max", label: "Max" },
];

const CONTEXT_BUDGETS: Array<{ value: number; label: string; desc: string }> = [
  { value: 50_000, label: "50K", desc: "Briefs and short documents." },
  { value: 200_000, label: "200K", desc: "Plans, specs, and several source files." },
  { value: 500_000, label: "500K", desc: "Large docs or compact repo packets." },
  { value: 1_000_000, label: "1M", desc: "Maximum local context budget for deep reviews." },
];

const INTENT_COPY: Record<Intent, { label: string; desc: string }> = {
  decision: { label: "Decision", desc: "The panel will help choose a path forward." },
  "stress-test": { label: "Plan review", desc: "The panel will critique the plan and find gaps." },
  compare: { label: "Compare options", desc: "The panel will evaluate alternatives side by side." },
  ideas: { label: "Competitive ideation", desc: "The panel will generate rival approaches." },
  "red-team": { label: "Red team", desc: "The panel will challenge assumptions aggressively." },
  debug: { label: "Debug", desc: "The panel will diagnose the issue and propose a fix strategy." },
};

const MODE_COPY: Record<SessionMode, { label: string; desc: string }> = {
  roundtable: { label: "Roundtable", desc: "Collaborative judgment and synthesis." },
  competitive: { label: "Competitive", desc: "Rival proposals, critique, and voting." },
  "formal-board": { label: "Formal Board Review", desc: "Independent first round, rebuttal, and a structured verdict." },
};

const SUPPORTED_FILE_EXTENSIONS = [".md", ".markdown", ".html", ".htm", ".txt", ".json", ".csv", ".tsv", ".yaml", ".yml"] as const;
const MAX_FILE_CHARS = 1_000_000;

const MODEL_BY_ID = new Map(PROVIDERS.map((model) => [model.id, model]));

function getModel(modelId: string): ProviderModel {
  return MODEL_BY_ID.get(modelId) ?? PROVIDERS[0];
}

function getThinkingOptions(modelId: string, localModels: LocalModelStatus[]) {
  const localModel = localModels.find((model) => model.id === modelId);
  const levels = localModel?.thinkingLevels?.length
    ? localModel.thinkingLevels
    : supportedThinkingLevels(getModel(modelId)).filter((level) => level !== "off");
  return THINKING_LEVELS.filter((level) => levels.includes(level.id));
}

function normalizeLensThinking(lens: PlannedLens, localModels: LocalModelStatus[]): PlannedLens {
  const options = getThinkingOptions(lens.modelId, localModels);
  if (options.some((option) => option.id === lens.thinkingLevel)) return lens;
  return {
    ...lens,
    thinkingLevel: (options.at(-1)?.id ?? "high") as ThinkingLevel,
  };
}

function inferIntent(text: string): Intent {
  return inferAdvisoryIntent(text);
}

function getInitial(name: string): string {
  return name.trim()[0]?.toUpperCase() || "A";
}

function isSupportedFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return file.type.startsWith("text/") || SUPPORTED_FILE_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / 104857.6) / 10} MB`;
}

function formatContextValue(contextWindow?: number): string {
  if (!contextWindow) return "";
  if (contextWindow >= 1_000_000) return `${contextWindow / 1_000_000}M`;
  if (contextWindow >= 1_000) return `${Math.round(contextWindow / 1_000)}K`;
  return String(contextWindow);
}

function formatModelContextSummary(model?: LocalModelStatus): string {
  if (!model) return "context checking";
  if (!model.contextWindow) return "context not reported";
  const value = formatContextValue(model.contextWindow);
  if (model.contextWindowSource === "verified") return `${value} verified`;
  if (model.contextWindowSource === "configured") return `${value} configured`;
  return "context not reported";
}

function buildAttachmentContext(files: AttachedFile[], contextBudgetChars: number) {
  if (files.length === 0) return "";
  let remaining = contextBudgetChars;
  const sections: string[] = ["Attached source material:"];

  for (const file of files) {
    if (remaining <= 0) break;
    const content = file.text.slice(0, Math.min(file.text.length, remaining));
    remaining -= content.length;
    sections.push(`\n--- ${file.name} ---\n${content}`);
  }

  return sections.join("\n");
}

function buildPlanContext(params: {
  mode: SessionMode;
  intent: Intent;
  stance: Stance;
  outputPerspective: OutputPerspective;
  responseLength: ResponseLength;
  lenses: PlannedLens[];
}) {
  const lines = params.lenses.map((lens, index) => {
    const model = getModel(lens.modelId);
    return `${index + 1}. ${lens.name} — ${lens.role} (${model.name}, thinking: ${lens.thinkingLevel}): ${lens.purpose}`;
  });

  return [
    "Approved session plan:",
    `Mode: ${params.mode}`,
    `Intent: ${params.intent}`,
    `Review stance: ${params.stance}`,
    `Final output perspective: ${params.outputPerspective}`,
    `Response length preference: ${params.responseLength}`,
    "Advisors:",
    ...lines,
  ].join("\n");
}

export default function LaunchWizard({ onClose, onLaunch }: LaunchWizardProps) {
  const [topic, setTopic] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [projectPath, setProjectPath] = useState("");
  const [projectContext, setProjectContext] = useState<ProjectContextPreview | null>(null);
  const [projectScanning, setProjectScanning] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [stance, setStance] = useState<Stance>("balanced");
  const [outputPerspective, setOutputPerspective] = useState<OutputPerspective>("decision-memo");
  const [rounds, setRounds] = useState(3);
  const [responseLength, setResponseLength] = useState<ResponseLength>("balanced");
  const [contextBudgetChars, setContextBudgetChars] = useState(200_000);
  const [pacing, setPacing] = useState("instant");
  const [plan, setPlan] = useState<{ mode: SessionMode; lenses: PlannedLens[] } | null>(null);
  const [planIntent, setPlanIntent] = useState<Intent | null>(null);
  const [planFallback, setPlanFallback] = useState(false);
  const [localTools, setLocalTools] = useState<Record<string, LocalToolStatus>>({});
  const [localModels, setLocalModels] = useState<LocalModelStatus[]>([]);
  const [availableModelIds, setAvailableModelIds] = useState<string[]>(PROVIDERS.map((provider) => provider.id));
  const [planning, setPlanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [providerDisclosureAccepted, setProviderDisclosureAccepted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/advisory/model-availability")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.tools) return;
        setLocalTools(data.tools as Record<string, LocalToolStatus>);
        const models = Array.isArray(data.models) ? (data.models as LocalModelStatus[]) : [];
        setLocalModels(models);
        const healthyModelIds = models.filter((model) => model.probe?.ok).map((model) => model.id);
        if (healthyModelIds.length > 0) setAvailableModelIds(healthyModelIds);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const inferenceText = useMemo(
    () => [topic, projectContext?.referenceContext ?? "", ...attachedFiles.map((file) => `${file.name}\n${file.text}`)].join("\n\n"),
    [attachedFiles, projectContext, topic],
  );
  useEffect(() => {
    setProviderDisclosureAccepted(false);
    setPlan(null);
    setPlanIntent(null);
  }, [inferenceText]);
  const intent = useMemo(() => inferIntent(inferenceText), [inferenceText]);
  const activeIntent = planIntent ?? intent;
  const intentInfo = INTENT_COPY[activeIntent];

  const detectedTools = Object.entries(localTools)
    .filter(([, status]) => status.available)
    .map(([id]) => id);
  const unavailableModels = localModels.filter((model) => model.probe && !model.probe.ok);
  const availableModelSet = useMemo(() => new Set(availableModelIds), [availableModelIds]);
  const availableModelOptions = MODELS.filter((option) => availableModelSet.has(option.id));
  const selectedModelIds = plan?.lenses.map((lens) => lens.modelId) ?? availableModelIds;
  const selectedModelSignature = selectedModelIds.join("|");
  const selectedContextWindows = selectedModelIds
    .map((modelId) => localModels.find((model) => model.id === modelId)?.contextWindow)
    .filter((value): value is number => typeof value === "number");
  const limitingKnownContextWindow = selectedContextWindows.length ? Math.min(...selectedContextWindows) : undefined;
  const contextBudgetOptions = CONTEXT_BUDGETS.map((item) => ({
    ...item,
    disabled: Boolean(limitingKnownContextWindow && item.value > limitingKnownContextWindow),
  }));
  const providerDisclosure = buildProviderDisclosure({
    topic: topic.trim(),
    attachedFileCount: attachedFiles.length,
    localProjectFileCount: projectContext?.selectedFiles.length ?? 0,
    sourceKinds: projectContext ? ["local-project"] : undefined,
    planningModelIds: ["claude-sonnet"],
    modelIds: selectedModelIds,
  });
  const mustAcceptDisclosure = providerDisclosure.requiresConsent && !providerDisclosureAccepted;

  useEffect(() => {
    if (!limitingKnownContextWindow || contextBudgetChars <= limitingKnownContextWindow) return;
    const nextBudget = CONTEXT_BUDGETS.filter((item) => item.value <= limitingKnownContextWindow).at(-1)?.value ?? CONTEXT_BUDGETS[0].value;
    setContextBudgetChars(nextBudget);
  }, [contextBudgetChars, limitingKnownContextWindow]);

  useEffect(() => {
    setProviderDisclosureAccepted(false);
  }, [contextBudgetChars, selectedModelSignature]);

  useEffect(() => {
    if (!projectContext) return;
    setProjectContext(null);
    setProviderDisclosureAccepted(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextBudgetChars]);

  useEffect(() => {
    if (!plan || localModels.length === 0) return;
    const normalized = plan.lenses.map((lens) => normalizeLensThinking(lens, localModels));
    if (normalized.some((lens, index) => lens.thinkingLevel !== plan.lenses[index].thinkingLevel)) {
      setPlan({ ...plan, lenses: normalized });
    }
  }, [localModels, plan]);

  const updateLens = (lensId: string, changes: Partial<PlannedLens>) => {
    if (!plan) return;
    setPlan((current) => ({
      ...current!,
      lenses: current!.lenses.map((lens) => {
        if (lens.id !== lensId) return lens;
        const updated = { ...lens, ...changes };
        return changes.modelId ? normalizeLensThinking(updated, localModels) : updated;
      }),
    }));
  };

  const removeLens = (lensId: string) => {
    if (!plan) return;
    setPlan((current) => ({
      ...current!,
      lenses: current!.lenses.filter((lens) => lens.id !== lensId),
    }));
  };

  const generatePlan = async () => {
    const cleanTopic = inferenceText.trim();
    if (!cleanTopic) {
      setError("Add a topic, decision, or source file first.");
      return;
    }
    if (mustAcceptDisclosure) {
      setError("Confirm provider disclosure before generating an AI advisor plan.");
      return;
    }

    setError("");
    setPlanning(true);
    try {
      const res = await fetch("/api/advisory/session-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: cleanTopic,
          modelId: "claude-sonnet",
          attachedFileCount: attachedFiles.length,
          localProjectFileCount: projectContext?.selectedFiles.length ?? 0,
          sourceKinds: projectContext ? ["local-project"] : undefined,
          providerDisclosure: providerDisclosureAccepted
            ? {
                accepted: true,
                acceptedAt: new Date().toISOString(),
                sensitivity: providerDisclosure.sensitivity,
                providers: providerDisclosure.providers,
                message: providerDisclosure.message,
              }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate plan");
      const responseAvailableModelIds = Array.isArray(data.availableModelIds) && data.availableModelIds.length > 0
        ? data.availableModelIds.map(String)
        : availableModelIds;
      const responseAvailableModelSet = new Set(responseAvailableModelIds);
      if (responseAvailableModelIds.length > 0) setAvailableModelIds(responseAvailableModelIds);
      const advisors = Array.isArray(data.advisors) ? data.advisors : [];
      if (advisors.length < 2) throw new Error("The planner did not return enough advisors.");
      const plannedLenses = advisors.map((advisor: Partial<PlannedLens>, index: number) => normalizeLensThinking({
        id: `advisor-${index}-${String(advisor.name || "advisor").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
        name: String(advisor.name || `Advisor ${index + 1}`).slice(0, 36),
        role: String(advisor.role || "Topic reviewer").slice(0, 90),
        purpose: String(advisor.purpose || "Reviews the topic from a useful angle.").slice(0, 220),
        modelId: responseAvailableModelSet.has(String(advisor.modelId)) ? String(advisor.modelId) : responseAvailableModelIds[0] ?? "claude-sonnet",
        thinkingLevel: (advisor.thinkingLevel || "high") as ThinkingLevel,
        stance: String(advisor.stance || "balanced").slice(0, 60),
      }, localModels));
      setPlan({
        mode: data.mode === "competitive" || data.mode === "formal-board" ? data.mode : "roundtable",
        lenses: plannedLenses,
      });
      setPlanIntent((data.intent || intent) as Intent);
      setPlanFallback(Boolean(data.fallback));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setPlanning(false);
    }
  };

  const addFiles = async (files: FileList | File[]) => {
    const incoming = Array.from(files);
    const unsupported = incoming.filter((file) => !isSupportedFile(file));
    const supported = incoming.filter(isSupportedFile);

    if (unsupported.length > 0) {
      setError(`Unsupported file type: ${unsupported.map((file) => file.name).join(", ")}. Use Markdown, HTML, text, JSON, CSV, TSV, or YAML.`);
    } else {
      setError("");
    }

    const parsed = await Promise.all(
      supported.map(async (file) => {
        const text = (await file.text()).slice(0, MAX_FILE_CHARS);
        return {
          id: `${file.name}-${file.size}-${file.lastModified}`,
          name: file.name,
          size: file.size,
          text,
        };
      }),
    );

    setAttachedFiles((current) => {
      const existing = new Set(current.map((file) => file.id));
      return [...current, ...parsed.filter((file) => !existing.has(file.id))];
    });
  };

  const removeFile = (fileId: string) => {
    setAttachedFiles((current) => current.filter((file) => file.id !== fileId));
  };

  const scanProject = async () => {
    const cleanPath = projectPath.trim();
    if (!cleanPath) {
      setProjectError("Enter a local project path first.");
      return;
    }
    setProjectScanning(true);
    setProjectError("");
    try {
      const res = await fetch("/api/advisory/project-context", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-panely-local-project-scan": "1",
        },
        body: JSON.stringify({
          projectPath: cleanPath,
          topic: topic.trim(),
          contextBudgetChars,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to scan project.");
      setProjectContext(data.projectContext as ProjectContextPreview);
      setProviderDisclosureAccepted(false);
    } catch (err) {
      setProjectContext(null);
      setProviderDisclosureAccepted(false);
      setProjectError(err instanceof Error ? err.message : "Failed to scan project.");
    } finally {
      setProjectScanning(false);
    }
  };

  const clearProject = () => {
    setProjectPath("");
    setProjectContext(null);
    setProjectError("");
    setProviderDisclosureAccepted(false);
  };

  const handleLaunch = async () => {
    const cleanTopic = topic.trim()
      || (projectContext ? `Debug local project ${projectContext.projectLabel}` : "")
      || (attachedFiles.length > 0 ? `Review attached material: ${attachedFiles.map((file) => file.name).join(", ")}` : "");
    if (!cleanTopic) {
      setError("Add a topic, decision, or source file first.");
      return;
    }
    if (!plan) {
      setError("Generate and review the advisor plan first.");
      return;
    }
    if (plan.lenses.length < 2) {
      setError("Use at least two perspectives.");
      return;
    }
    if (mustAcceptDisclosure) {
      setError("Confirm provider disclosure before starting this session.");
      return;
    }

    setError("");
    setLoading(true);

    const agents = plan.lenses.map((lens) => lens.name);
    const agentModelOverrides = Object.fromEntries(plan.lenses.map((lens) => [lens.name, lens.modelId]));
    const agentPersonalityTraits = Object.fromEntries(plan.lenses.map((lens) => [lens.name, [lens.stance, lens.thinkingLevel]]));
    const agentCommunicationStyles = Object.fromEntries(plan.lenses.map((lens) => [lens.name, `${lens.role}. ${lens.purpose}`]));
    const agentIntensityLevels = Object.fromEntries(plan.lenses.map((lens) => [lens.name, lens.thinkingLevel === "max" ? 10 : lens.thinkingLevel === "xhigh" ? 9 : 7]));
    const agentResponseLengths = Object.fromEntries(plan.lenses.map((lens) => [lens.name, responseLength]));
    const agentThinkingLevels = Object.fromEntries(plan.lenses.map((lens) => [lens.name, lens.thinkingLevel]));
    const planContext = buildPlanContext({
      mode: plan.mode,
      intent: planIntent ?? intent,
      stance,
      outputPerspective,
      responseLength,
      lenses: plan.lenses,
    });
    const attachmentContext = buildAttachmentContext(attachedFiles, contextBudgetChars);
    const mergedContext = [planContext, projectContext?.referenceContext ?? "", attachmentContext].filter(Boolean).join("\n\n---\n\n");

    try {
      const res = await fetch("/api/advisory/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: cleanTopic,
          mode: plan.mode,
          agents,
          model: plan.lenses[0]?.modelId ?? "claude-sonnet",
          rounds,
          pacing,
          responseLength,
          referenceContextBudgetChars: contextBudgetChars,
          referenceContext: mergedContext,
          sourceKinds: projectContext ? ["local-project"] : undefined,
          localProjectFileCount: projectContext?.selectedFiles.length ?? 0,
          agentModelOverrides,
          agentPersonalityTraits,
          agentCommunicationStyles,
          agentIntensityLevels,
          agentResponseLengths,
          agentThinkingLevels,
          providerDisclosure: {
            accepted: providerDisclosureAccepted,
            acceptedAt: providerDisclosureAccepted ? new Date().toISOString() : undefined,
            sensitivity: providerDisclosure.sensitivity,
            providers: providerDisclosure.providers,
            message: providerDisclosure.message,
          },
          aiPersonas: plan.lenses.map((lens) => ({
            id: lens.id,
            name: lens.name,
            role: lens.role,
            description: lens.purpose,
            modelId: lens.modelId,
            thinkingLevel: lens.thinkingLevel,
          })),
          moderator: agents[0],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create session");
      onLaunch(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="launch-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="launch-modal">
        <header className="launch-header">
          <div>
            <div className="eyebrow">New session</div>
            <h2>Plan a roundtable</h2>
            <p>Brief the topic. Panely recommends the perspectives, models, and session shape.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close setup">
            <X size={20} />
          </button>
        </header>

        <main className="launch-grid">
          <section className="setup-column">
            <div
              className={`field topic-dropzone ${isDraggingFile ? "dragging" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDraggingFile(true);
              }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDraggingFile(false);
                void addFiles(event.dataTransfer.files);
              }}
            >
              <label htmlFor="topic">Decision or topic</label>
              <textarea
                id="topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Ask for what you want: review this plan, compare these options, red-team this memo, or help me decide."
                rows={6}
                maxLength={2200}
              />
              <div className="topic-actions">
                <span>{topic.length}/2200</span>
                <label className="attach-button" htmlFor="sourceFiles">
                  <Paperclip size={14} />
                  Attach files
                </label>
                <input
                  id="sourceFiles"
                  type="file"
                  multiple
                  accept=".md,.markdown,.html,.htm,.txt,.json,.csv,.tsv,.yaml,.yml,text/*"
                  onChange={(event) => {
                    if (event.target.files) void addFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
              </div>
              <div className="drop-hint">
                <Upload size={14} />
                Drop Markdown, HTML, text, JSON, CSV, TSV, or YAML files here.
              </div>
              {attachedFiles.length > 0 && (
                <div className="attached-files">
                  {attachedFiles.map((file) => (
                    <div className="attached-file" key={file.id}>
                      <FileText size={14} />
                      <span>{file.name}</span>
                      <small>{formatBytes(file.size)}</small>
                      <button type="button" onClick={() => removeFile(file.id)} aria-label={`Remove ${file.name}`}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="field local-project-box">
              <div className="local-project-header">
                <div>
                  <label htmlFor="projectPath">Local project</label>
                  <span>Scan happens on this machine. Advisor planning and session launch can send the selected packet through local CLIs after disclosure.</span>
                </div>
                {projectContext && (
                  <button type="button" className="mini-button" onClick={clearProject}>
                    Clear
                  </button>
                )}
              </div>
              <div className="project-scan-row">
                <input
                  id="projectPath"
                  value={projectPath}
                  onChange={(event) => {
                    setProjectPath(event.target.value);
                    setProjectContext(null);
                    setProjectError("");
                    setProviderDisclosureAccepted(false);
                  }}
                  placeholder="/path/to/project"
                />
                <button type="button" className="secondary-button compact" onClick={scanProject} disabled={projectScanning || !projectPath.trim()}>
                  {projectScanning ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                  Scan
                </button>
              </div>
              {projectError && (
                <div className="project-error">
                  <AlertCircle size={14} />
                  {projectError}
                </div>
              )}
              {projectContext && (
                <div className="project-summary">
                  <div className="project-summary-main">
                    <strong>{projectContext.projectLabel}</strong>
                    <span>
                      {projectContext.selectedFiles.length} selected · {projectContext.candidateFileCount} candidates · {projectContext.referenceContextChars.toLocaleString()} chars
                    </span>
                  </div>
                  <div className="project-file-list">
                    {projectContext.selectedFiles.slice(0, 8).map((file) => (
                      <div className="project-file" key={file.path} title={file.reasons.join("; ")}>
                        <FileText size={13} />
                        <span>{file.path}</span>
                        <small>{formatBytes(file.size)}{file.truncated ? " · truncated" : ""}</small>
                      </div>
                    ))}
                    {projectContext.selectedFiles.length > 8 && (
                      <div className="project-file muted">
                        +{projectContext.selectedFiles.length - 8} more selected files
                      </div>
                    )}
                  </div>
                  {projectContext.warnings.length > 0 && (
                    <div className="project-warnings">
                      {projectContext.warnings.slice(0, 4).map((warning, index) => (
                        <div key={`${warning.code}-${warning.path || index}`}>
                          <AlertCircle size={12} />
                          <span>{warning.path ? `${warning.path}: ` : ""}{warning.message}</span>
                        </div>
                      ))}
                      {projectContext.warnings.length > 4 && <small>+{projectContext.warnings.length - 4} more warnings</small>}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="field">
              <label>Detected intent</label>
              <div className="intent-card">
                <div>
                  <strong>{intentInfo.label}</strong>
                  <span>{intentInfo.desc}</span>
                </div>
                <Sparkles size={16} />
              </div>
            </div>

            {providerDisclosure.requiresConsent && (
              <div className="provider-disclosure">
                <div>
                  <AlertCircle size={16} />
                  <strong>Provider disclosure</strong>
                </div>
                <p>{providerDisclosure.message}</p>
                <p>
                  This is still local-first storage: Panely keeps sessions on this machine, but selected local CLIs may send prompts and source material to their model providers.
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={providerDisclosureAccepted}
                    onChange={(event) => setProviderDisclosureAccepted(event.target.checked)}
                  />
                  I understand and want to continue.
                </label>
              </div>
            )}

            <button type="button" className="generate-plan-button" onClick={generatePlan} disabled={planning || !inferenceText.trim() || mustAcceptDisclosure}>
              {planning ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
              {plan ? "Regenerate advisor plan" : "Generate advisor plan"}
            </button>

            <div className="field">
              <label>Review stance</label>
              <div className="segmented">
                {STANCES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={stance === item.id ? "selected" : ""}
                    onClick={() => setStance(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-grid">
              <div className="field">
                <label htmlFor="rounds">Rounds</label>
                <select id="rounds" value={rounds} onChange={(event) => setRounds(Number(event.target.value))}>
                  {[2, 3, 4, 5, 7, 10].map((count) => (
                    <option key={count} value={count}>
                      {count} rounds
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="pacing">Pacing</label>
                <select id="pacing" value={pacing} onChange={(event) => setPacing(event.target.value)}>
                  {PACING_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label>Response length</label>
              <div className="segmented">
                {RESPONSE_LENGTHS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={responseLength === item.id ? "selected" : ""}
                    onClick={() => setResponseLength(item.id)}
                    title={item.desc}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Context budget</label>
              <div className="segmented">
                {contextBudgetOptions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={contextBudgetChars === item.value ? "selected" : ""}
                    disabled={item.disabled}
                    onClick={() => setContextBudgetChars(item.value)}
                    title={item.disabled ? `Above the limiting reported/configured selected model context (${formatContextValue(limitingKnownContextWindow)}).` : item.desc}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <small>
                {limitingKnownContextWindow
                  ? `Budgets are capped by the smallest reported or configured selected model context: ${formatContextValue(limitingKnownContextWindow)}.`
                  : "Selected model CLIs have not reported a context limit; Panely will use this as the source-packet budget only."}
              </small>
            </div>

            <div className="field">
              <label htmlFor="outputPerspective">Output perspective</label>
              <select
                id="outputPerspective"
                value={outputPerspective}
                onChange={(event) => setOutputPerspective(event.target.value as OutputPerspective)}
              >
                {OUTPUTS.map((output) => (
                  <option key={output.id} value={output.id}>
                    {output.label}
                  </option>
                ))}
              </select>
            </div>

          </section>

          <section className="plan-column">
            {!plan ? (
              <div className="plan-empty">
                <Sparkles size={22} />
                <h3>Advisor plan appears here after analysis</h3>
                <p>Add the topic or source file first, then generate a plan. Panely will name the advisors, define what each one does, and choose a specific model and thinking level.</p>
              </div>
            ) : (
              <>
                <div className="plan-toolbar">
                  <div>
                    <div className="eyebrow">{planFallback ? "Fallback plan" : "AI-generated plan"}</div>
                    <h3>{MODE_COPY[plan.mode].label}</h3>
                  </div>
                  <button type="button" className="secondary-button" onClick={generatePlan} disabled={planning}>
                    {planning ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                    Regenerate
                  </button>
                </div>

                <div className="summary-strip">
                  <div className="summary-icon">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <strong>{plan.lenses.length} advisors</strong>
                    <span>
                      {intentInfo.label} · {rounds} rounds · {responseLength} responses · {stance} stance
                    </span>
                  </div>
                </div>

                <div className="field">
                  <label>Session mode</label>
                  <div className="mode-options">
                    {(Object.entries(MODE_COPY) as Array<[SessionMode, (typeof MODE_COPY)[SessionMode]]>).map(([modeId, copy]) => (
                      <button
                        key={modeId}
                        type="button"
                        className={plan.mode === modeId ? "selected" : ""}
                        onClick={() => setPlan((current) => current ? { ...current, mode: modeId } : current)}
                      >
                        <strong>{copy.label}</strong>
                        <span>{copy.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="local-status">
                  <CheckCircle2 size={14} />
                  {detectedTools.length > 0
                    ? `Local tools detected: ${detectedTools.map((tool) => tool[0].toUpperCase() + tool.slice(1)).join(", ")}`
                    : "Checking local model tools..."}
                </div>
                <div className={unavailableModels.length > 0 ? "availability-note warning" : "availability-note"}>
                  {availableModelOptions.length > 0
                    ? `${availableModelOptions.length} local model${availableModelOptions.length === 1 ? "" : "s"} available for this panel.`
                    : "No local models are available yet."}
                  {unavailableModels.length > 0
                    ? ` Unavailable models are hidden from setup: ${unavailableModels.map((model) => model.name).join(", ")}.`
                    : " Panely will only suggest models that pass local CLI checks."}
                </div>

                <div className="lens-list">
                  {plan.lenses.map((lens) => {
                    const model = getModel(lens.modelId);
                    const localModel = localModels.find((item) => item.id === lens.modelId);
                    const thinkingOptions = getThinkingOptions(lens.modelId, localModels);
                    return (
                      <div className="lens-row" key={lens.id}>
                        <div className="agent-initial" aria-hidden="true">
                          {getInitial(lens.name)}
                        </div>
                        <div className="lens-copy">
                          <div className="lens-title">
                            <strong>{lens.name}</strong>
                            <span>{lens.role}</span>
                          </div>
                          <p>{lens.purpose}</p>
                          <small>{lens.stance}</small>
                        </div>
                        <div className="lens-controls">
                          <select value={lens.modelId} onChange={(event) => updateLens(lens.id, { modelId: event.target.value })}>
                            {(availableModelOptions.length ? availableModelOptions : MODELS).map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={lens.thinkingLevel}
                            disabled={thinkingOptions.length === 0}
                            onChange={(event) => updateLens(lens.id, { thinkingLevel: event.target.value as ThinkingLevel })}
                          >
                            {(thinkingOptions.length ? thinkingOptions : [{ id: "high" as ThinkingLevel, label: "Not enforced" }]).map((level) => (
                              <option key={level.id} value={level.id}>
                                {level.label}
                              </option>
                            ))}
                          </select>
                          <span title={[localModel?.contextNote, localModel?.thinkingNote].filter(Boolean).join(" ") || undefined}>
                            {model.provider} · {formatModelContextSummary(localModel)}{localModel?.thinkingEnforced === false ? " · thinking not enforced" : ""}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="icon-button subtle"
                          onClick={() => removeLens(lens.id)}
                          aria-label={`Remove ${lens.name}`}
                          disabled={plan.lenses.length <= 2}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {error && (
              <div className="error-box">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </section>
        </main>

        <footer className="launch-footer">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={handleLaunch} disabled={loading || !plan || mustAcceptDisclosure}>
            {loading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
            Start session
          </button>
        </footer>
      </div>

      <style jsx>{`
        .launch-backdrop {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(0, 0, 0, 0.7);
        }

        .launch-modal {
          width: min(1180px, calc(100vw - 48px));
          max-height: min(920px, calc(100vh - 48px));
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
        }

        .launch-header,
        .launch-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 22px 24px;
          border-bottom: 1px solid var(--border);
        }

        .launch-footer {
          border-top: 1px solid var(--border);
          border-bottom: none;
        }

        .launch-header h2,
        .plan-toolbar h3 {
          margin: 0;
          color: var(--text-primary);
          font-family: var(--font-heading);
          letter-spacing: 0;
        }

        .launch-header h2 {
          font-size: 24px;
        }

        .launch-header p {
          margin: 6px 0 0;
          color: var(--text-secondary);
          font-size: 14px;
        }

        .eyebrow {
          margin-bottom: 4px;
          color: var(--accent);
          font: 700 11px var(--font-mono);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .launch-grid {
          display: grid;
          grid-template-columns: minmax(330px, 0.9fr) minmax(480px, 1.1fr);
          min-height: 0;
          overflow: auto;
        }

        .setup-column,
        .plan-column {
          min-width: 0;
          padding: 24px;
        }

        .setup-column {
          border-right: 1px solid var(--border);
        }

        .field {
          margin-bottom: 18px;
        }

        .topic-dropzone {
          border: 1px dashed transparent;
          border-radius: 10px;
          padding: 2px;
          transition: border-color 0.15s ease, background-color 0.15s ease;
        }

        .topic-dropzone.dragging {
          border-color: var(--accent);
          background: rgba(99, 102, 241, 0.08);
        }

        label {
          display: block;
          margin-bottom: 8px;
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 700;
        }

        textarea,
        input,
        select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-elevated);
          color: var(--text-primary);
          font: 500 13px var(--font-body);
          outline: none;
        }

        textarea {
          resize: vertical;
          min-height: 96px;
          padding: 12px;
          line-height: 1.5;
        }

        select {
          min-height: 42px;
          padding: 0 12px;
        }

        textarea:focus,
        input:focus,
        select:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.16);
        }

        .field-note {
          margin-top: 6px;
          color: var(--text-muted);
          font-size: 11px;
          text-align: right;
        }

        .topic-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 8px;
          color: var(--text-muted);
          font-size: 11px;
        }

        .topic-actions input {
          display: none;
        }

        .attach-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin: 0;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 7px 10px;
          color: var(--text-secondary);
          font-size: 12px;
          cursor: pointer;
        }

        .attach-button:hover {
          border-color: var(--accent);
          color: var(--text-primary);
        }

        .drop-hint {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 10px;
          border: 1px dashed var(--border);
          border-radius: 8px;
          padding: 10px 12px;
          color: var(--text-muted);
          font-size: 12px;
        }

        .attached-files {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 10px;
        }

        .attached-file {
          display: grid;
          grid-template-columns: 16px minmax(0, 1fr) auto 28px;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.03);
          padding: 8px 10px;
          color: var(--text-secondary);
          font-size: 12px;
        }

        .attached-file span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .attached-file small {
          color: var(--text-muted);
          font-size: 11px;
        }

        .attached-file button {
          display: grid;
          place-items: center;
          width: 26px;
          height: 26px;
          border: none;
          border-radius: 7px;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
        }

        .attached-file button:hover {
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-primary);
        }

        .local-project-box {
          border: 1px solid var(--border);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.025);
          padding: 14px;
        }

        .local-project-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }

        .local-project-header label {
          margin-bottom: 4px;
        }

        .local-project-header span {
          display: block;
          color: var(--text-muted);
          font-size: 12px;
          line-height: 1.45;
        }

        .project-scan-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
        }

        .project-scan-row input {
          min-height: 40px;
          padding: 0 12px;
        }

        .secondary-button.compact {
          min-width: 92px;
          min-height: 40px;
        }

        .mini-button {
          flex: 0 0 auto;
          min-height: 30px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: transparent;
          color: var(--text-secondary);
          padding: 0 10px;
          font: 800 11px var(--font-body);
          cursor: pointer;
        }

        .mini-button:hover {
          border-color: var(--accent);
          color: var(--text-primary);
        }

        .project-error {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-top: 10px;
          border: 1px solid rgba(239, 68, 68, 0.32);
          border-radius: 8px;
          background: rgba(239, 68, 68, 0.08);
          color: #f87171;
          padding: 10px;
          font-size: 12px;
          line-height: 1.4;
        }

        .project-error svg,
        .project-warnings svg {
          flex: 0 0 auto;
          margin-top: 1px;
        }

        .project-summary {
          margin-top: 12px;
          border: 1px solid rgba(34, 197, 94, 0.26);
          border-radius: 8px;
          background: rgba(34, 197, 94, 0.06);
          padding: 12px;
        }

        .project-summary-main {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        .project-summary-main strong {
          min-width: 0;
          overflow: hidden;
          color: var(--text-primary);
          font-size: 13px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .project-summary-main span {
          flex: 0 0 auto;
          color: var(--text-muted);
          font-size: 11px;
        }

        .project-file-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .project-file {
          display: grid;
          grid-template-columns: 16px minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 7px;
          background: rgba(0, 0, 0, 0.18);
          padding: 7px 8px;
          color: var(--text-secondary);
          font-size: 12px;
        }

        .project-file.muted {
          display: block;
          color: var(--text-muted);
          text-align: center;
        }

        .project-file span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .project-file small {
          color: var(--text-muted);
          font-size: 10px;
          white-space: nowrap;
        }

        .project-warnings {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 10px;
          color: #fbbf24;
          font-size: 11px;
          line-height: 1.35;
        }

        .project-warnings div {
          display: flex;
          gap: 6px;
        }

        .project-warnings small {
          color: var(--text-muted);
        }

        .intent-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-elevated);
          padding: 13px 14px;
        }

        .intent-card strong,
        .intent-card span {
          display: block;
        }

        .intent-card strong {
          color: var(--text-primary);
          font-size: 13px;
        }

        .intent-card span {
          margin-top: 3px;
          color: var(--text-muted);
          font-size: 12px;
          line-height: 1.4;
        }

        .intent-card svg {
          flex: 0 0 auto;
          color: var(--accent);
        }

        .provider-disclosure {
          margin-bottom: 20px;
          border: 1px solid rgba(245, 158, 11, 0.35);
          border-radius: 8px;
          background: rgba(245, 158, 11, 0.08);
          padding: 14px;
        }

        .provider-disclosure > div {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #fbbf24;
          font-size: 13px;
        }

        .provider-disclosure p {
          margin: 8px 0 0;
          color: var(--text-secondary);
          font-size: 12px;
          line-height: 1.5;
        }

        .provider-disclosure label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          color: var(--text-primary);
          font-size: 12px;
          font-weight: 800;
        }

        .generate-plan-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          min-height: 44px;
          margin-bottom: 20px;
          border: none;
          border-radius: 8px;
          background: var(--accent);
          color: white;
          font: 800 13px var(--font-body);
          cursor: pointer;
        }

        .generate-plan-button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .segmented {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .mode-options {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .mode-options button {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          min-height: 74px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-elevated);
          color: var(--text-secondary);
          padding: 12px;
          text-align: left;
          cursor: pointer;
        }

        .mode-options button.selected {
          border-color: var(--accent);
          background: var(--accent-soft);
        }

        .mode-options strong {
          color: var(--text-primary);
          font-size: 12px;
        }

        .mode-options span {
          color: var(--text-muted);
          font-size: 11px;
          line-height: 1.35;
        }

        .segmented-compact {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }

        .segmented button,
        .secondary-button,
        .ghost-button,
        .primary-button,
        .icon-button {
          min-height: 38px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: transparent;
          color: var(--text-secondary);
          font: 700 12px var(--font-body);
          cursor: pointer;
        }

        .segmented button {
          padding: 0 10px;
          white-space: normal;
        }

        .segmented button.selected {
          border-color: var(--accent);
          background: var(--accent-soft);
          color: var(--accent);
        }

        .control-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .plan-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .plan-empty {
          display: flex;
          min-height: 420px;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          border: 1px dashed var(--border);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.02);
          padding: 28px;
          text-align: center;
        }

        .plan-empty svg {
          color: var(--accent);
          margin-bottom: 12px;
        }

        .plan-empty h3 {
          margin: 0;
          color: var(--text-primary);
          font: 800 17px var(--font-heading);
        }

        .plan-empty p {
          max-width: 460px;
          margin: 10px 0 0;
          color: var(--text-muted);
          font-size: 13px;
          line-height: 1.55;
        }

        .summary-strip,
        .local-status,
        .error-box {
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-elevated);
          padding: 14px;
        }

        .summary-strip {
          margin-bottom: 12px;
        }

        .summary-icon,
        .agent-initial {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 999px;
          border: 1px solid var(--accent);
          color: var(--accent);
          background: var(--accent-soft);
        }

        .summary-icon {
          width: 38px;
          height: 38px;
        }

        .summary-strip strong {
          display: block;
          color: var(--text-primary);
          font-size: 15px;
        }

        .summary-strip span,
        .local-status {
          color: var(--text-secondary);
          font-size: 12px;
        }

        .local-status {
          margin-bottom: 16px;
          min-height: 42px;
          padding: 10px 12px;
          color: var(--text-muted);
        }

        .local-status svg {
          color: #22c55e;
        }

        .availability-note {
          margin: -6px 0 16px;
          border: 1px solid rgba(34, 197, 94, 0.25);
          border-radius: 8px;
          background: rgba(34, 197, 94, 0.07);
          color: var(--text-secondary);
          padding: 10px 12px;
          font-size: 12px;
          line-height: 1.45;
        }

        .availability-note.warning {
          border-color: rgba(245, 158, 11, 0.28);
          background: rgba(245, 158, 11, 0.08);
          color: #fbbf24;
        }

        .lens-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .lens-row {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr) 190px 40px;
          align-items: center;
          gap: 12px;
          min-height: 94px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
          padding: 14px;
        }

        .agent-initial {
          width: 38px;
          height: 38px;
          font-weight: 800;
        }

        .lens-copy {
          min-width: 0;
        }

        .lens-title {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 5px;
        }

        .lens-title strong {
          color: var(--text-primary);
          font-size: 14px;
        }

        .lens-title span,
        .lens-copy p,
        .lens-controls span,
        .lens-copy small {
          color: var(--text-muted);
          font-size: 12px;
        }

        .lens-copy p {
          margin: 0;
          line-height: 1.45;
        }

        .lens-copy small {
          display: block;
          margin-top: 7px;
          text-transform: capitalize;
        }

        .lens-controls {
          min-width: 0;
        }

        .lens-controls select {
          min-height: 36px;
          margin-bottom: 6px;
          font-size: 12px;
        }

        .add-lens {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          margin-top: 14px;
        }

        .secondary-button,
        .ghost-button,
        .primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 14px;
        }

        .secondary-button:hover,
        .ghost-button:hover,
        .icon-button:hover {
          border-color: var(--accent);
          color: var(--text-primary);
        }

        .secondary-button:disabled,
        .icon-button:disabled,
        .primary-button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .primary-button {
          min-width: 150px;
          border: none;
          background: var(--accent);
          color: white;
          font-size: 13px;
        }

        .ghost-button {
          min-width: 92px;
        }

        .icon-button {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          padding: 0;
        }

        .icon-button.subtle {
          width: 36px;
          height: 36px;
        }

        .error-box {
          margin-top: 14px;
          border-color: rgba(239, 68, 68, 0.35);
          background: rgba(239, 68, 68, 0.08);
          color: #f87171;
          font-size: 13px;
        }

        .spin {
          animation: spin 0.9s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 920px) {
          .launch-backdrop {
            padding: 12px;
          }

          .launch-modal {
            width: calc(100vw - 24px);
            max-height: calc(100vh - 24px);
          }

          .launch-grid {
            grid-template-columns: 1fr;
          }

          .setup-column {
            border-right: none;
            border-bottom: 1px solid var(--border);
          }

          .lens-row {
            grid-template-columns: 40px minmax(0, 1fr);
          }

          .lens-controls {
            grid-column: 2;
          }

          .lens-row .icon-button {
            grid-column: 2;
            justify-self: end;
          }
        }

        @media (max-width: 620px) {
          .launch-header,
          .launch-footer,
          .setup-column,
          .plan-column {
            padding: 16px;
          }

          .segmented,
          .segmented-compact,
          .control-grid,
          .project-scan-row,
          .add-lens {
            grid-template-columns: 1fr;
          }

          .project-summary-main {
            flex-direction: column;
            gap: 4px;
          }

          .project-summary-main span {
            flex: 0 1 auto;
          }

          .secondary-button.compact {
            width: 100%;
          }

          .launch-footer {
            align-items: stretch;
            flex-direction: column-reverse;
          }

          .primary-button,
          .ghost-button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
