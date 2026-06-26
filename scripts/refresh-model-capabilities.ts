#!/usr/bin/env node
import { PROVIDERS } from "../src/lib/ai/providers.ts";
import {
  PROVIDER_CAPABILITY_CACHE_FILE,
  providerThinkingLevels,
  refreshProviderCapabilityCache,
  staticProviderThinkingLevels,
} from "../src/lib/ai/provider-capability-cache.ts";

const cache = await refreshProviderCapabilityCache();

console.log(`Refreshed provider capability cache: ${PROVIDER_CAPABILITY_CACHE_FILE}`);
console.log(`Checked at: ${cache.refreshedAt}`);

if (cache.errors?.length) {
  console.log("\nWarnings:");
  for (const error of cache.errors) console.log(`- ${error}`);
}

console.log("\nModel thinking capabilities:");
for (const model of PROVIDERS) {
  const staticLevels = staticProviderThinkingLevels(model);
  const refreshedLevels = providerThinkingLevels(model, cache);
  const changed = staticLevels.join(",") !== refreshedLevels.join(",");
  console.log(`- ${model.name}: ${refreshedLevels.join(", ") || "none"}${changed ? ` (static: ${staticLevels.join(", ") || "none"})` : ""}`);
}
