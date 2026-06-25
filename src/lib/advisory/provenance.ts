import type { AdvisoryModelProvenance } from "../../types/advisory.ts";
import { getProviderModelById, PROVIDERS } from "../ai/providers.ts";

function findProviderModel(modelIdOrSource?: string) {
  if (!modelIdOrSource) return getProviderModelById();
  return (
    PROVIDERS.find((model) =>
      model.id === modelIdOrSource ||
      model.model === modelIdOrSource ||
      model.routedModel === modelIdOrSource ||
      modelIdOrSource.endsWith(`:${model.model}`)
    ) || getProviderModelById(modelIdOrSource)
  );
}

export function buildRequestedModelProvenance(modelId?: string, observedModel?: string): AdvisoryModelProvenance {
  const normalizedObservedModel = observedModel?.includes(":") ? observedModel : undefined;
  const providerModel = findProviderModel(modelId || normalizedObservedModel);
  return {
    requestedModelId: providerModel.id,
    requestedModel: providerModel.model,
    requestedProvider: providerModel.provider,
    localCli: providerModel.localCli,
    routedModel: providerModel.routedModel,
    observedModel: normalizedObservedModel,
    verificationStatus: normalizedObservedModel ? "reported-by-cli" : "requested-only",
    note: normalizedObservedModel
      ? "Model identity includes the local CLI result reported to Panely."
      : "Panely can verify the requested local CLI model, but this CLI response did not report an independently observed executed model.",
  };
}

export function formatModelProvenance(provenance?: AdvisoryModelProvenance) {
  if (!provenance) return "Model provenance unavailable.";
  const source = provenance.localCli ? `Local ${provenance.localCli} CLI` : "Configured provider";
  const observed = provenance.observedModel ? `Observed: ${provenance.observedModel}` : "Observed model not reported by CLI";
  return `${source}; requested ${provenance.requestedModel}; ${observed}. ${provenance.note}`;
}
