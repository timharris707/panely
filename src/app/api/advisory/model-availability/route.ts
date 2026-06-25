import { NextResponse } from "next/server";
import { PROVIDERS } from "@/lib/ai/providers";
import { detectLocalCliTools, probeModelHealth } from "@/lib/ai/model-health";
import { supportedThinkingLevels } from "@/lib/ai/thinking-levels";

export async function GET(request: Request) {
  const probeMode = new URL(request.url).searchParams.get("probe");
  const forceProbe = probeMode === "1" || probeMode === "large";
  const largeContext = probeMode === "large";
  const tools = detectLocalCliTools({ force: forceProbe });
  const models = PROVIDERS.map((model) => ({
    id: model.id,
    name: model.name,
    provider: model.provider,
    model: model.model,
    localCli: model.localCli,
    source: model.localCli ? `Local ${model.localCli} CLI` : "Not configured",
    available: model.localCli ? Boolean(tools[model.localCli]?.available) : false,
    cliPath: model.localCli ? tools[model.localCli]?.path : undefined,
    cliVersion: model.localCli ? tools[model.localCli]?.version : undefined,
    intent: model.intent,
    contextWindow: model.contextWindow,
    thinkingLevels: supportedThinkingLevels(model).filter((level) => level !== "off"),
    thinkingEnforced: model.localCli !== "gemini",
    thinkingNote: model.localCli === "gemini"
      ? "Gemini CLI thinking level is not enforced because the installed CLI does not expose a stable thinking flag."
      : "Thinking level is passed to the local CLI.",
    intendedUse: model.intendedUse,
    probe: probeModelHealth(model.id, { force: forceProbe, largeContext }),
  }));
  return NextResponse.json({ tools, models, routing: "local-cli-only" });
}
