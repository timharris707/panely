import { createHash } from "node:crypto";

export interface SourcePacket {
  topic: string;
  referenceContext?: string;
  text: string;
  hash: string;
  preview: string;
}

function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

export function buildSourcePacket(input: { topic: string; referenceContext?: string; maxPreviewChars?: number }): SourcePacket {
  const topic = normalizeText(input.topic);
  const referenceContext = input.referenceContext ? normalizeText(input.referenceContext) : undefined;
  const text = [
    "# Topic",
    topic,
    "",
    referenceContext ? "# Source Material" : "",
    referenceContext || "",
  ].filter(Boolean).join("\n\n");
  const hash = createHash("sha256").update(text, "utf8").digest("hex");
  const maxPreviewChars = input.maxPreviewChars ?? 1600;

  return {
    topic,
    referenceContext,
    text,
    hash,
    preview: text.slice(0, maxPreviewChars),
  };
}
