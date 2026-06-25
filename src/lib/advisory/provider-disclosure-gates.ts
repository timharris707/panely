import { buildProviderDisclosure } from "./provider-disclosure.ts";

function selectedModelIds(defaultModel: unknown, overrides: unknown) {
  const ids = new Set<string>();
  ids.add(typeof defaultModel === "string" && defaultModel ? defaultModel : "claude-sonnet");
  if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) {
    for (const value of Object.values(overrides)) {
      if (typeof value === "string" && value) ids.add(value);
    }
  }
  return Array.from(ids);
}

export function validateSessionPlanProviderDisclosure(body: Record<string, unknown>) {
  const topic = String(body?.topic || "").trim();
  const plannerDisclosure = buildProviderDisclosure({
    topic,
    attachedFileCount: Number(body?.attachedFileCount || 0),
    planningModelIds: [String(body?.modelId || "claude-sonnet")],
    modelIds: [],
  });
  const providerDisclosure = body?.providerDisclosure;
  const disclosureAccepted = Boolean(
    providerDisclosure &&
    typeof providerDisclosure === "object" &&
    !Array.isArray(providerDisclosure) &&
    (providerDisclosure as { accepted?: unknown }).accepted === true
  );

  return {
    plannerDisclosure,
    disclosureAccepted,
    allowed: !plannerDisclosure.requiresConsent || disclosureAccepted,
  };
}

export function buildSessionProviderDisclosureForRequest(body: Record<string, unknown>) {
  const topic = String(body.topic || "");
  const disclosure = buildProviderDisclosure({
    topic,
    attachedFileCount: body.referenceContext ? 1 : 0,
    planningModelIds: ["claude-sonnet"],
    modelIds: selectedModelIds(body.model, body.agentModelOverrides),
  });
  const providerDisclosure = body.providerDisclosure;
  const accepted = Boolean(
    providerDisclosure &&
    typeof providerDisclosure === "object" &&
    !Array.isArray(providerDisclosure) &&
    (providerDisclosure as { accepted?: unknown }).accepted === true
  );
  const acceptedAt =
    accepted &&
    typeof (providerDisclosure as { acceptedAt?: unknown }).acceptedAt === "string"
      ? (providerDisclosure as { acceptedAt: string }).acceptedAt
      : undefined;

  return {
    disclosure,
    accepted,
    allowed: !disclosure.requiresConsent || accepted,
    persisted: {
      accepted,
      acceptedAt,
      sensitivity: disclosure.sensitivity,
      providers: disclosure.providers,
      message: disclosure.message,
    },
  };
}
