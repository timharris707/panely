import type { SourceKind } from "./provider-disclosure.ts";

export function buildLocalProjectStartSummary(sourceKinds?: SourceKind[], localProjectFileCount = 0) {
  if (!sourceKinds?.includes("local-project")) return "";
  const selectedCount = Math.max(0, Math.trunc(localProjectFileCount));
  return `\n\n**Local project packet:** ${selectedCount || "Selected"} file${selectedCount === 1 ? "" : "s"} selected. Absolute local path redacted.`;
}
