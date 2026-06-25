import { NextResponse } from "next/server";
import { PROVIDERS } from "@/lib/ai/providers";
import { detectLocalCliTools, probeModelHealth } from "@/lib/ai/model-health";

export async function GET(request: Request) {
  const probeMode = new URL(request.url).searchParams.get("probe");
  const shouldProbe = probeMode === "1" || probeMode === "large";
  const largeContext = probeMode === "large";
  const tools = detectLocalCliTools();
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
    thinkingLevels: model.thinkingLevels,
    intendedUse: model.intendedUse,
    probe: shouldProbe ? probeModelHealth(model.id, { largeContext }) : undefined,
  }));
  return NextResponse.json({ tools, models, routing: "local-cli-only" });
}
