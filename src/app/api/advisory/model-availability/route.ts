import { NextResponse } from "next/server";
import { PROVIDERS } from "@/lib/ai/providers";
import { detectLocalCliTools, probeModelHealth } from "@/lib/ai/model-health";
import { supportedThinkingLevels } from "@/lib/ai/thinking-levels";
import {
  providerThinkingLevels,
  providerThinkingSource,
  readProviderCapabilityCache,
} from "@/lib/ai/provider-capability-cache";

export async function GET(request: Request) {
  const probeMode = new URL(request.url).searchParams.get("probe");
  const forceProbe = probeMode === "1" || probeMode === "large";
  const largeContext = probeMode === "large";
  const tools = detectLocalCliTools({ force: forceProbe });
  const providerCapabilityCache = readProviderCapabilityCache();
  const models = PROVIDERS.map((model) => {
    const toolStatus = model.localCli ? tools[model.localCli] : undefined;
    const providerLevels = providerThinkingLevels(model, providerCapabilityCache);
    const providerSource = providerThinkingSource(model, providerCapabilityCache);
    const selectableLevels = supportedThinkingLevels(model, { ...toolStatus, providerThinkingLevels: providerLevels }).filter((level) => level !== "off");
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
      thinkingLevels: selectableLevels,
      thinkingEnforced: Boolean(toolStatus?.thinkingEnforced),
      thinkingNote: selectableLevels.length
        ? toolStatus?.thinkingNote
        : providerLevels.length
          ? `${providerSource.sourceName} supports ${providerLevels.join(", ")} for this model family, but Panely's current ${model.localCli ? `${model.localCli} CLI adapter` : "local adapter"} does not enforce a thinking parameter.`
          : toolStatus?.thinkingNote,
      thinkingEvidence: toolStatus?.thinkingEvidence,
      thinkingCapabilityCheckedAt: toolStatus?.capabilityCheckedAt,
      thinkingCapabilitySchemaVersion: toolStatus?.capabilitySchemaVersion,
      providerThinkingLevels: providerLevels,
      providerThinkingSourceUrl: providerSource.sourceUrl,
      providerThinkingSourceName: providerSource.sourceName,
      providerThinkingEvidence: providerSource.evidence,
      providerThinkingFetchedAt: providerSource.fetchedAt || providerCapabilityCache?.refreshedAt,
      intendedUse: model.intendedUse,
      probe: probeModelHealth(model.id, { force: forceProbe, largeContext }),
    };
  });
  return NextResponse.json({ tools, models, routing: "local-cli-only" });
}
