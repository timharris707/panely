import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/ai/router";
import { getProviderModelById, PROVIDERS, resolveProviderModelId, type ProviderModel } from "@/lib/ai/providers";
import { detectLocalCliTools, probeAllModelHealth } from "@/lib/ai/model-health";
import { supportedThinkingLevels } from "@/lib/ai/thinking-levels";
import { validateSessionPlanProviderDisclosure } from "@/lib/advisory/provider-disclosure-gates";
import {
  inferAdvisoryIntent,
  inferAdvisoryMode,
  type AdvisoryIntent,
  type AdvisoryPlannedMode,
} from "@/lib/advisory/session-intent";

type Intent = AdvisoryIntent;
type PlannedMode = AdvisoryPlannedMode;
type ThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

interface PlannedAdvisor {
  name: string;
  role: string;
  purpose: string;
  modelId: string;
  thinkingLevel: ThinkingLevel;
  stance: string;
}

const ALLOWED_MODELS = PROVIDERS.map((provider) => provider.id);
const ALLOWED_THINKING: ThinkingLevel[] = ["minimal", "low", "medium", "high", "xhigh", "max"];

function healthyProviderModels() {
  const health = probeAllModelHealth();
  const tools = detectLocalCliTools();
  const healthyIds = new Set(health.filter((result) => result.ok).map((result) => result.id));
  const models = PROVIDERS.filter((provider) => healthyIds.has(provider.id));
  const thinkingLevelsByModelId = new Map(models.map((provider) => [
    provider.id,
    supportedThinkingLevels(provider, provider.localCli ? tools[provider.localCli] : undefined).filter((level) => level !== "off") as ThinkingLevel[],
  ]));
  return {
    health,
    tools,
    models,
    ids: models.map((provider) => provider.id),
    thinkingLevelsByModelId,
  };
}

function chooseModel(availableModelIds: string[], preferredIds: string[]) {
  const available = new Set(availableModelIds.length ? availableModelIds : ALLOWED_MODELS);
  return preferredIds.find((modelId) => available.has(modelId)) ?? availableModelIds[0] ?? "claude-sonnet";
}

function inferMode(intent: Intent, topic: string): PlannedMode {
  return inferAdvisoryMode(intent, topic);
}

function supportedPlannerThinkingLevels(model: ProviderModel, thinkingLevelsByModelId?: Map<string, ThinkingLevel[]>) {
  return thinkingLevelsByModelId?.get(model.id) ?? supportedThinkingLevels(model).filter((level) => level !== "off") as ThinkingLevel[];
}

function normalizeFallbackThinkingLevel(modelId: string, requested: ThinkingLevel, thinkingLevelsByModelId?: Map<string, ThinkingLevel[]>) {
  const model = getProviderModelById(modelId);
  const levels = supportedPlannerThinkingLevels(model, thinkingLevelsByModelId);
  return levels.includes(requested) ? requested : (levels.at(-1) ?? "high");
}

function fallbackPlan(topic: string, availableModelIds = ALLOWED_MODELS, thinkingLevelsByModelId?: Map<string, ThinkingLevel[]>): { intent: Intent; mode: PlannedMode; advisors: PlannedAdvisor[] } {
  const intent = inferAdvisoryIntent(topic);
  const mode = inferMode(intent, topic);
  const lower = topic.toLowerCase();
  const advisors: PlannedAdvisor[] = intent === "debug" ? [
    {
      name: "Root Cause Analyst",
      role: "Bug diagnosis and evidence reviewer",
      purpose: "Uses the pain point, stack traces, and selected files to identify likely root causes and confidence.",
      modelId: chooseModel(availableModelIds, ["codex-frontier", "claude-opus", "claude-sonnet", "gemini-flash"]),
      thinkingLevel: "max",
      stance: "diagnostic",
    },
    {
      name: "Architecture Reviewer",
      role: "System boundary and data-flow reviewer",
      purpose: "Checks whether the failure comes from architecture, state flow, dependency boundaries, or integration assumptions.",
      modelId: chooseModel(availableModelIds, ["claude-opus", "claude-sonnet", "codex-frontier", "gemini-flash"]),
      thinkingLevel: "max",
      stance: "systems",
    },
    {
      name: "Regression Engineer",
      role: "Test and reproduction specialist",
      purpose: "Defines the smallest reproduction, missing regression tests, and commands that would prove the fix.",
      modelId: chooseModel(availableModelIds, ["gemini-flash", "codex-frontier", "claude-sonnet", "claude-opus"]),
      thinkingLevel: "high",
      stance: "testing",
    },
    {
      name: "Patch Strategist",
      role: "Minimal fix and rollout planner",
      purpose: "Proposes the smallest coherent fix strategy, sequencing, and risk controls.",
      modelId: chooseModel(availableModelIds, ["codex-frontier", "claude-sonnet", "gemini-flash", "claude-opus"]),
      thinkingLevel: "high",
      stance: "practical",
    },
    {
      name: "Adversarial Reviewer",
      role: "Hypothesis challenger",
      purpose: "Challenges weak assumptions and prevents overconfident fixes when evidence is incomplete.",
      modelId: chooseModel(availableModelIds, ["claude-sonnet", "claude-opus", "codex-frontier", "gemini-flash"]),
      thinkingLevel: "max",
      stance: "adversarial",
    },
  ] : [
    {
      name: "Decision Lead",
      role: "Moderator and synthesis reviewer",
      purpose: "Frames the decision, keeps the discussion focused, and produces the final recommendation.",
      modelId: chooseModel(availableModelIds, ["claude-opus", "claude-sonnet", "codex-frontier", "gemini-flash"]),
      thinkingLevel: "max",
      stance: "synthesis",
    },
    {
      name: "Reality Reviewer",
      role: "Plan quality and assumptions critic",
      purpose: "Finds gaps, weak assumptions, missing evidence, and changes needed before execution.",
      modelId: chooseModel(availableModelIds, ["claude-sonnet", "claude-opus", "codex-frontier", "gemini-flash"]),
      thinkingLevel: "max",
      stance: "skeptical",
    },
    {
      name: "Market Reviewer",
      role: "Customer, market, and positioning analyst",
      purpose: "Evaluates market fit, audience, competition, positioning, and go-to-market implications.",
      modelId: chooseModel(availableModelIds, ["codex-frontier", "claude-sonnet", "gemini-flash", "claude-opus"]),
      thinkingLevel: "high",
      stance: "commercial",
    },
    {
      name: "Execution Reviewer",
      role: "Implementation and operating model reviewer",
      purpose: "Checks whether the plan is buildable, sequenced correctly, and operationally realistic.",
      modelId: chooseModel(availableModelIds, ["gemini-flash", "codex-frontier", "claude-sonnet", "claude-opus"]),
      thinkingLevel: "high",
      stance: "practical",
    },
  ];

  if (intent !== "debug" && /(legal|compliance|privacy|regulatory|contract|medical|health|claims?)/.test(lower)) {
    advisors.splice(2, 0, {
      name: "Risk Counsel",
      role: "Legal, compliance, and policy risk reviewer",
      purpose: "Flags legal exposure, compliance obligations, privacy risks, and claims that need care.",
      modelId: chooseModel(availableModelIds, ["claude-opus", "claude-sonnet", "codex-frontier", "gemini-flash"]),
      thinkingLevel: "max",
      stance: "risk",
    });
  }

  if (intent !== "debug" && /(software|app|api|database|architecture|security|code|engineering|local|cli|model)/.test(lower)) {
    advisors.splice(2, 0, {
      name: "Technical Reviewer",
      role: "Architecture, implementation, and security reviewer",
      purpose: "Reviews technical feasibility, architecture, data flow, security, and implementation risk.",
      modelId: chooseModel(availableModelIds, ["codex-frontier", "gemini-flash", "claude-sonnet", "claude-opus"]),
      thinkingLevel: "max",
      stance: "technical",
    });
  }

  return {
    intent,
    mode,
    advisors: advisors.slice(0, 6).map((advisor) => ({
      ...advisor,
      thinkingLevel: normalizeFallbackThinkingLevel(advisor.modelId, advisor.thinkingLevel, thinkingLevelsByModelId),
    })),
  };
}

function normalizeThinkingLevel(
  thinkingLevel: unknown,
  model: ProviderModel,
  fallbackThinking: ThinkingLevel,
  thinkingLevelsByModelId?: Map<string, ThinkingLevel[]>
): ThinkingLevel {
  const requested = typeof thinkingLevel === "string" && ALLOWED_THINKING.includes(thinkingLevel as ThinkingLevel)
    ? (thinkingLevel as ThinkingLevel)
    : fallbackThinking;
  const supported = supportedPlannerThinkingLevels(model, thinkingLevelsByModelId);
  return supported.includes(requested) ? requested : (supported.at(-1) ?? fallbackThinking);
}

function normalizeAdvisor(
  advisor: Partial<PlannedAdvisor>,
  index: number,
  fallbackAdvisors: PlannedAdvisor[],
  availableModelIds: string[],
  thinkingLevelsByModelId: Map<string, ThinkingLevel[]>
): PlannedAdvisor {
  const fallback = fallbackAdvisors[index] ?? fallbackAdvisors[0];
  const modelId =
    typeof advisor.modelId === "string" && availableModelIds.includes(advisor.modelId)
      ? advisor.modelId
      : fallback.modelId;
  const providerModel = getProviderModelById(modelId);
  const thinkingLevel =
    normalizeThinkingLevel(advisor.thinkingLevel, providerModel, fallback.thinkingLevel, thinkingLevelsByModelId);

  return {
    name: String(advisor.name || fallback.name).slice(0, 36),
    role: String(advisor.role || fallback.role).slice(0, 90),
    purpose: String(advisor.purpose || fallback.purpose).slice(0, 220),
    modelId,
    thinkingLevel,
    stance: String(advisor.stance || fallback.stance).slice(0, 60),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const topic = String(body?.topic || "").trim();

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const { plannerDisclosure, allowed } = validateSessionPlanProviderDisclosure(body || {});
    if (!allowed) {
      return NextResponse.json(
        {
          error: "Provider disclosure must be accepted before Panely sends this source material to the AI planner.",
          providerDisclosure: plannerDisclosure,
        },
        { status: 403 }
      );
    }

    const available = healthyProviderModels();
    if (available.models.length === 0) {
      return NextResponse.json(
        {
          error: "No local AI model CLIs are available. Install and sign in to at least one supported CLI, then try again.",
          modelHealth: available.health,
        },
        { status: 503 }
      );
    }

    const availableModelIds = available.ids;
    const requestedPlannerModelId = resolveProviderModelId(body?.modelId || "claude-sonnet");
    const plannerModelId = availableModelIds.includes(requestedPlannerModelId)
      ? requestedPlannerModelId
      : chooseModel(availableModelIds, ["claude-sonnet", "claude-opus", "codex-frontier", "gemini-flash"]);
    const fallback = fallbackPlan(topic, availableModelIds, available.thinkingLevelsByModelId);
    const availableModelLines = available.models
      .map((provider) => {
        const levels = available.thinkingLevelsByModelId.get(provider.id) ?? [];
        const levelText = levels.length ? levels.join(", ") : "none; thinking not enforced";
        return `- ${provider.id}: ${provider.name}; thinking levels: ${levelText}; ${provider.intendedUse ?? provider.intent ?? "available local CLI model"}`;
      })
      .join("\n");

    const systemPrompt = `You design clean AI advisory-board sessions.

Return ONLY valid JSON. No markdown.

Available model IDs that passed local CLI checks:
${availableModelLines}

Create named advisors specifically for this topic. Do not use existing product agent names. Do not use generic labels like Agent 1. The names should sound like temporary advisory roles, not permanent mascots. Use ONLY the available model IDs and per-model thinking levels listed above. If a model lists no thinking levels, use "high" as a harmless placeholder and Panely will not enforce it.`;

  const prompt = `Topic and source material:
${topic.slice(0, 12000)}

Inferred intent from heuristics: ${fallback.intent}

Return JSON with this exact shape:
{
  "intent": "decision" | "stress-test" | "compare" | "ideas" | "red-team" | "debug",
  "mode": "roundtable" | "competitive" | "formal-board",
  "advisors": [
    {
      "name": "short role name",
      "role": "what they do",
      "purpose": "why this advisor is needed for this topic",
      "modelId": "one allowed model id",
      "thinkingLevel": "one allowed thinking level",
      "stance": "brief point of view"
    }
  ]
}

Use 4-6 advisors. If the user asks to review a plan, use stress-test and include at least one skeptical/reality-checking reviewer. If the user describes a bug, failing test, stack trace, regression, build error, or local project debugging issue, use debug and include root-cause, architecture, test/regression, patch strategy, and adversarial review perspectives.

Mode guidance:
- roundtable: exploratory collaborative judgment.
- competitive: rival proposals, critique, and voting.
- formal-board: high-stakes review, independent first round, rebuttal, and a structured ship/caution/block verdict.`;

    try {
      const result = await generateText({
        modelId: plannerModelId,
        systemPrompt,
        prompt,
        maxTokens: 2400,
        temperature: 0.25,
      });

      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Planner returned no JSON object");
      const parsed = JSON.parse(jsonMatch[0]) as {
        intent?: Intent;
        mode?: PlannedMode;
        advisors?: Array<Partial<PlannedAdvisor>>;
      };

      const intent: Intent = parsed.intent && ["decision", "stress-test", "compare", "ideas", "red-team", "debug"].includes(parsed.intent)
        ? parsed.intent
        : fallback.intent;
      const mode: PlannedMode = parsed.mode === "competitive" || parsed.mode === "formal-board"
        ? parsed.mode
        : inferMode(intent, topic);
      const advisors = Array.isArray(parsed.advisors)
        ? parsed.advisors.slice(0, 6).map((advisor, index) => normalizeAdvisor(advisor, index, fallback.advisors, availableModelIds, available.thinkingLevelsByModelId))
        : fallback.advisors;

      return NextResponse.json({
        intent,
        mode,
        advisors,
        plannerModelId: result.modelId,
        fallback: false,
        availableModelIds,
        unavailableModelIds: ALLOWED_MODELS.filter((modelId) => !availableModelIds.includes(modelId)),
        modelHealth: available.health,
      });
    } catch (plannerErr) {
      console.warn("[Advisory] Session planner failed; using fallback plan.", plannerErr);
      return NextResponse.json({
        ...fallback,
        fallback: true,
        plannerModelId,
        availableModelIds,
        unavailableModelIds: ALLOWED_MODELS.filter((modelId) => !availableModelIds.includes(modelId)),
        modelHealth: available.health,
      });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
