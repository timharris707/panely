import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/ai/router";
import { getProviderModelById, PROVIDERS, resolveProviderModelId, type ProviderModel } from "@/lib/ai/providers";
import { probeAllModelHealth } from "@/lib/ai/model-health";

type Intent = "decision" | "stress-test" | "compare" | "ideas" | "red-team";
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
  const healthyIds = new Set(health.filter((result) => result.ok).map((result) => result.id));
  const models = PROVIDERS.filter((provider) => healthyIds.has(provider.id));
  return {
    health,
    models,
    ids: models.map((provider) => provider.id),
  };
}

function inferIntent(text: string): Intent {
  const lower = text.toLowerCase();
  if (/(red[- ]?team|attack this|tear (this|it) apart|adversarial|devil'?s advocate)/.test(lower)) return "red-team";
  if (/(compare|versus| vs |alternative|option|which of these|trade[- ]?off)/.test(lower)) return "compare";
  if (/(brainstorm|generate ideas|come up with|new ideas|pitch|ideat)/.test(lower)) return "ideas";
  if (/(review|critique|audit|stress[- ]?test|pressure[- ]?test|evaluate|solid|gaps?|risks?|weakness|improve|fix|revise|changes? needed)/.test(lower)) return "stress-test";
  return "decision";
}

function chooseModel(availableModelIds: string[], preferredIds: string[]) {
  const available = new Set(availableModelIds.length ? availableModelIds : ALLOWED_MODELS);
  return preferredIds.find((modelId) => available.has(modelId)) ?? availableModelIds[0] ?? "claude-sonnet";
}

function fallbackPlan(topic: string, availableModelIds = ALLOWED_MODELS): { intent: Intent; mode: "roundtable" | "competitive"; advisors: PlannedAdvisor[] } {
  const intent = inferIntent(topic);
  const mode = intent === "ideas" ? "competitive" : "roundtable";
  const lower = topic.toLowerCase();
  const advisors: PlannedAdvisor[] = [
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
      thinkingLevel: "xhigh",
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

  if (/(legal|compliance|privacy|regulatory|contract|medical|health|claims?)/.test(lower)) {
    advisors.splice(2, 0, {
      name: "Risk Counsel",
      role: "Legal, compliance, and policy risk reviewer",
      purpose: "Flags legal exposure, compliance obligations, privacy risks, and claims that need care.",
      modelId: chooseModel(availableModelIds, ["claude-opus", "claude-sonnet", "codex-frontier", "gemini-flash"]),
      thinkingLevel: "max",
      stance: "risk",
    });
  }

  if (/(software|app|api|database|architecture|security|code|engineering|local|cli|model)/.test(lower)) {
    advisors.splice(2, 0, {
      name: "Technical Reviewer",
      role: "Architecture, implementation, and security reviewer",
      purpose: "Reviews technical feasibility, architecture, data flow, security, and implementation risk.",
      modelId: chooseModel(availableModelIds, ["codex-frontier", "gemini-flash", "claude-sonnet", "claude-opus"]),
      thinkingLevel: "xhigh",
      stance: "technical",
    });
  }

  return { intent, mode, advisors: advisors.slice(0, 6) };
}

function normalizeThinkingLevel(thinkingLevel: unknown, model: ProviderModel, fallbackThinking: ThinkingLevel): ThinkingLevel {
  const requested = typeof thinkingLevel === "string" && ALLOWED_THINKING.includes(thinkingLevel as ThinkingLevel)
    ? (thinkingLevel as ThinkingLevel)
    : fallbackThinking;
  return model.thinkingLevels?.includes(requested) ? requested : (model.thinkingLevels?.at(-1) ?? fallbackThinking);
}

function normalizeAdvisor(advisor: Partial<PlannedAdvisor>, index: number, fallbackAdvisors: PlannedAdvisor[], availableModelIds: string[]): PlannedAdvisor {
  const fallback = fallbackAdvisors[index] ?? fallbackAdvisors[0];
  const modelId =
    typeof advisor.modelId === "string" && availableModelIds.includes(advisor.modelId)
      ? advisor.modelId
      : fallback.modelId;
  const providerModel = getProviderModelById(modelId);
  const thinkingLevel =
    normalizeThinkingLevel(advisor.thinkingLevel, providerModel, fallback.thinkingLevel);

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
    const fallback = fallbackPlan(topic, availableModelIds);
    const availableModelLines = available.models
      .map((provider) => `- ${provider.id}: ${provider.name}, ${provider.intendedUse ?? provider.intent ?? "available local CLI model"}`)
      .join("\n");

    const systemPrompt = `You design clean AI advisory-board sessions.

Return ONLY valid JSON. No markdown.

Available model IDs that passed local CLI checks:
${availableModelLines}

Thinking levels: minimal, low, medium, high, xhigh, max.

Create named advisors specifically for this topic. Do not use existing product agent names. Do not use generic labels like Agent 1. The names should sound like temporary advisory roles, not permanent mascots. Use ONLY the available model IDs listed above.`;

    const prompt = `Topic and source material:
${topic.slice(0, 12000)}

Inferred intent from heuristics: ${fallback.intent}

Return JSON with this exact shape:
{
  "intent": "decision" | "stress-test" | "compare" | "ideas" | "red-team",
  "mode": "roundtable" | "competitive",
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

Use 4-6 advisors. If the user asks to review a plan, use stress-test and include at least one skeptical/reality-checking reviewer.`;

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
        mode?: "roundtable" | "competitive";
        advisors?: Array<Partial<PlannedAdvisor>>;
      };

      const intent: Intent = parsed.intent && ["decision", "stress-test", "compare", "ideas", "red-team"].includes(parsed.intent)
        ? parsed.intent
        : fallback.intent;
      const mode = parsed.mode === "competitive" || intent === "ideas" ? "competitive" : "roundtable";
      const advisors = Array.isArray(parsed.advisors)
        ? parsed.advisors.slice(0, 6).map((advisor, index) => normalizeAdvisor(advisor, index, fallback.advisors, availableModelIds))
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
