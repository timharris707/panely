export type AdvisoryResponseLength = "concise" | "balanced" | "detailed" | "verbose";

export const RESPONSE_LENGTH_INSTRUCTIONS: Record<AdvisoryResponseLength, string> = {
  concise: "Maximum 3-4 sentences. No headers. No filler.",
  balanced: "150-250 words. One key insight and one recommendation.",
  detailed: "300-500 words with specific analysis and recommendations.",
  verbose: "Full analysis with examples, details, and comprehensive recommendations.",
};

export function normalizeResponseLength(value: unknown): AdvisoryResponseLength {
  return value === "concise" || value === "balanced" || value === "detailed" || value === "verbose"
    ? value
    : "balanced";
}
