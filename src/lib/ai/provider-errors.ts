export type ProviderErrorKind =
  | "timeout"
  | "model-not-found"
  | "auth"
  | "rate-limit"
  | "provider-runtime"
  | "empty-output"
  | "unknown";

export interface ClassifiedProviderError {
  kind: ProviderErrorKind;
  message: string;
}

const SECRET_PATTERNS = [
  /(sk-[A-Za-z0-9_-]{12,})/g,
  /(OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY)=\S+/g,
  /(Bearer\s+)[A-Za-z0-9._-]+/g,
];

export function sanitizeProviderOutput(value: unknown, maxLength = 800) {
  let text = String(value ?? "").replace(/\u001b\[[0-9;]*m/g, "");
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, (_match, prefix) => (prefix ? `${prefix}[redacted]` : "[redacted]"));
  }
  text = text.replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function classifyProviderError(error: unknown): ClassifiedProviderError {
  const message = sanitizeProviderOutput(error);
  const lower = message.toLowerCase();

  if (lower.includes("timed out") || lower.includes("timeout")) {
    return { kind: "timeout", message };
  }
  if (lower.includes("modelnotfound") || lower.includes("model not found") || lower.includes("requested entity was not found") || lower.includes("unknown model")) {
    return { kind: "model-not-found", message };
  }
  if (lower.includes("auth") || lower.includes("unauthorized") || lower.includes("permission denied") || lower.includes("api key")) {
    return { kind: "auth", message };
  }
  if (lower.includes("rate limit") || lower.includes("quota") || lower.includes("429")) {
    return { kind: "rate-limit", message };
  }
  if (lower.includes("empty output") || lower.includes("no output")) {
    return { kind: "empty-output", message };
  }
  if (lower.includes("exited with code") || lower.includes("critical error") || lower.includes("unsettled top-level await")) {
    return { kind: "provider-runtime", message };
  }

  return { kind: "unknown", message };
}
