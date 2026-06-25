import { NextResponse } from "next/server";
import { PROVIDERS } from "@/lib/ai/providers";
import { detectLocalCliTools, probeModelHealth } from "@/lib/ai/model-health";
import { supportedThinkingLevels } from "@/lib/ai/thinking-levels";

export async function GET(request: Request) {
  const probeMode = new URL(request.url).searchParams.get("probe");
  const forceProbe = probeMode === "1" || probeMode === "large";
  const largeContext = probeMode === "large";
  const tools = detectLocalCliTools({ force: forceProbe });
  const models = PROVIDERS.map((model) => {
    const toolStatus = model.localCli ? tools[model.localCli] : undefined;
    return {
      id: model.id,
      name: model.name,
      provider: model.provider,
      model: model.model,
      localCli: model.localCli,
      source: model.localCli ? `Local ${model.localCli} CLI` : "Not configured",
      available: model.localCli ? Boolean(toolStatus?.available) : false,
      cliPath: toolStatus?.path,
      cliVersion: toolStatus?.version,
      intent: model.intent,
      contextWindow: toolStatus?.contextWindow,
      contextWindowSource: toolStatus?.contextWindowSource,
      contextEvidence: toolStatus?.contextEvidence,
      contextNote: toolStatus?.contextNote,
      thinkingLevels: supportedThinkingLevels(model, toolStatus).filter((level) => level !== "off"),
      thinkingEnforced: Boolean(toolStatus?.thinkingEnforced),
      thinkingNote: toolStatus?.thinkingNote,
      thinkingEvidence: toolStatus?.thinkingEvidence,
      thinkingCapabilityCheckedAt: toolStatus?.capabilityCheckedAt,
      thinkingCapabilitySchemaVersion: toolStatus?.capabilitySchemaVersion,
      intendedUse: model.intendedUse,
      probe: probeModelHealth(model.id, { force: forceProbe, largeContext }),
    };
  });
  return NextResponse.json({ tools, models, routing: "local-cli-only" });
}
