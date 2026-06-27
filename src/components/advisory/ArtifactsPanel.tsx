"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  ShieldAlert,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AdvisoryEvent, AdvisorySession, BoardBrief, DecisionRecord } from "@/types/advisory";
import { formatMarkdownFileExport, slugify } from "./constants";

type ArtifactKind = "full-artifact" | "decision-memo" | "action-plan" | "risk-memo" | "board-brief";
type ArtifactFormat = "pdf" | "html" | "md";

type BriefPayload = {
  brief?: BoardBrief;
  decisionRecord?: DecisionRecord;
  error?: string;
};

type SessionBriefPayload = {
  sessionId: string;
  value: BriefPayload;
};

type ArtifactDefinition = {
  id: ArtifactKind;
  label: string;
  shortLabel: string;
  description: string;
  icon: ComponentType<{ size?: number; className?: string }>;
};

type ArtifactDocument = {
  id: ArtifactKind;
  title: string;
  description: string;
  markdown: string;
  fileStem: string;
};

interface ArtifactsPanelProps {
  open: boolean;
  session: AdvisorySession;
  events: AdvisoryEvent[];
  onClose: () => void;
}

const ARTIFACTS: ArtifactDefinition[] = [
  {
    id: "full-artifact",
    label: "Full Artifact",
    shortLabel: "Full",
    description: "Complete decision record and transcript from beginning to end.",
    icon: FileText,
  },
  {
    id: "decision-memo",
    label: "Decision Memo",
    shortLabel: "Memo",
    description: "Recommendation, rationale, options, dissent, and decision record.",
    icon: CheckCircle2,
  },
  {
    id: "action-plan",
    label: "Action Plan",
    shortLabel: "Plan",
    description: "Ordered next steps, owners, dependencies, and follow-up checks.",
    icon: ClipboardList,
  },
  {
    id: "risk-memo",
    label: "Risk Memo",
    shortLabel: "Risk",
    description: "Failure modes, weak assumptions, exposure, and mitigations.",
    icon: ShieldAlert,
  },
  {
    id: "board-brief",
    label: "Board Brief",
    shortLabel: "Brief",
    description: "Executive-ready summary with decision, arguments, and provenance.",
    icon: FileText,
  },
];

const LIST_MARKER_PATTERN = /^\s*(?:[-*]\s+|\d+[.)]\s+)/;
const DUPLICATE_SECTION_LABELS = new Set([
  "evidence-backed",
  "evidence backed",
  "judgment calls",
  "judgment call",
  "could not verify",
  "minority report",
  "next actions",
  "next action",
  "open questions",
  "open question",
]);

function normalizeSectionLabel(value: string) {
  return value
    .replace(/^#{1,6}\s+/, "")
    .replace(/\*\*/g, "")
    .replace(/:\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function repairBrokenBold(value: string) {
  const trimmed = value.trimStart();
  if (/^["'{\[]/.test(trimmed)) return value;
  if (/^(?:[-*]|\d+[.)])\s+\*\*/.test(trimmed)) return value;
  return value
    .replace(/^([^*#\n][^:\n]{2,180}):\*\*(\s*)/, "**$1:** ")
    .replace(/^([^*#\n]{2,180}?)\*\*(\s+[—-]\s+)/, "**$1**$2")
    .replace(/^([^*#\n]{2,180}?)\*\*(\s+)/, "**$1**$2");
}

function normalizeArtifactMarkdown(markdown: string) {
  const output: string[] = [];
  let previousHeading = "";
  let headingCanDropDuplicate = false;
  let inFence = false;

  for (const rawLine of markdown.split(/\r?\n/)) {
    if (rawLine.trim().startsWith("```")) {
      inFence = !inFence;
      output.push(rawLine);
      continue;
    }
    if (inFence) {
      output.push(rawLine);
      continue;
    }

    const line = repairBrokenBold(rawLine);
    const trimmed = line.trim();
    if (!trimmed) {
      output.push(line);
      continue;
    }

    const listHeading = trimmed.match(/^[-*]\s+(#{1,6}\s+)?(.+)$/);
    if (listHeading?.[1]) {
      const label = normalizeSectionLabel(listHeading[2]);
      if (DUPLICATE_SECTION_LABELS.has(label)) continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const label = normalizeSectionLabel(heading[2]);
      if (headingCanDropDuplicate && label && label === previousHeading) continue;
      previousHeading = label;
      headingCanDropDuplicate = true;
      output.push(line);
      continue;
    }

    const plainLabel = normalizeSectionLabel(trimmed.replace(LIST_MARKER_PATTERN, ""));
    if (headingCanDropDuplicate && plainLabel === previousHeading && DUPLICATE_SECTION_LABELS.has(plainLabel)) {
      continue;
    }

    headingCanDropDuplicate = false;
    output.push(line);
  }

  return output.join("\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

function listItems(items: string[] | undefined, fallback: string) {
  if (!items?.length) return [`- ${fallback}`];
  return items.map((item) => `- ${item}`);
}

function actionItems(record?: DecisionRecord) {
  if (!record?.actionItems?.length) return ["- No explicit action items were extracted."];
  return record.actionItems.map((item, index) => {
    const owner = item.owner ? ` (${item.owner})` : "";
    const priority = item.priority ? ` [${item.priority}]` : "";
    return `${index + 1}. ${item.title}${owner}${priority}${item.source ? ` - Source: ${item.source}` : ""}`;
  });
}

function provenanceItems(record?: DecisionRecord, brief?: BoardBrief) {
  const source = record?.provenance?.length
    ? record.provenance
    : brief?.modelProvenance?.map((item) => ({ ...item, provenance: undefined }));
  if (!source?.length) return ["- No model provenance was recorded."];
  return source.map((item) => {
    const model = item.model || "unknown model";
    const status = item.status ? ` - ${item.status}` : "";
    const duration = typeof item.durationMs === "number" ? ` - ${(item.durationMs / 1000).toFixed(1)}s` : "";
    return `- ${item.agent}: ${model}${status}${duration}`;
  });
}

function oneLine(value: string | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function truncateTitle(value: string, maxLength = 92) {
  const text = oneLine(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function topicTitle(session: AdvisorySession, record?: DecisionRecord, brief?: BoardBrief) {
  return truncateTitle(session.title || record?.title || brief?.title || session.topic || "Panely session");
}

function topicValue(session: AdvisorySession, record?: DecisionRecord, brief?: BoardBrief) {
  return oneLine(record?.topic || brief?.topic || session.topic || "No topic recorded.");
}

function metaItems(items: Array<[string, string | undefined]>) {
  return items
    .map(([label, value]) => [label, oneLine(value)] as const)
    .filter(([, value]) => value)
    .map(([label, value]) => `- **${label}:** ${value}`);
}

function artifactStem(session: AdvisorySession, kind: ArtifactKind) {
  const date = (session.completedAt || session.createdAt || new Date().toISOString()).slice(0, 10);
  const topicSlug = slugify(session.title || session.topic) || "panely-session";
  return `${topicSlug}-${kind}-${date}`;
}

function buildDecisionMemo(session: AdvisorySession, record?: DecisionRecord, brief?: BoardBrief) {
  const title = topicTitle(session, record, brief);
  return [
    `# Decision Memo: ${title}`,
    "",
    ...metaItems([
      ["Topic", topicValue(session, record, brief)],
      ["Mode", record?.mode || brief?.mode || session.mode],
      ["Generated", record?.generatedAt || brief?.generatedAt || new Date().toISOString()],
    ]),
    "",
    "## Decision",
    "",
    record?.decision || brief?.decision || "No final decision was extracted.",
    "",
    "## Recommendation",
    "",
    record?.recommendation || brief?.recommendation || "No recommendation was extracted.",
    "",
    "## Options Considered",
    "",
    ...(record?.optionsConsidered?.length
      ? record.optionsConsidered.map((option) => `- ${option.rank ? `${option.rank}. ` : ""}${option.title}${typeof option.votes === "number" ? ` (${option.votes} votes)` : ""}: ${option.summary}`)
      : brief?.topIdeas?.length
        ? brief.topIdeas.map((idea) => `- ${idea.rank ? `${idea.rank}. ` : ""}${idea.idea}${typeof idea.votes === "number" ? ` (${idea.votes} votes)` : ""}`)
        : ["- No ranked options were recorded."]),
    "",
    "## Dissent and Caveats",
    "",
    ...(record?.dissent?.length
      ? record.dissent.map((item) => `- ${item.agent}: ${item.summary}`)
      : listItems(brief?.dissent, "No explicit dissent was recorded.")),
    "",
    "## Risks",
    "",
    ...listItems(record?.risks || brief?.risks, "No explicit risks were extracted."),
    "",
    "## Open Questions",
    "",
    ...listItems(record?.openQuestions, "No open questions were extracted."),
    "",
    "## Action Items",
    "",
    ...actionItems(record),
    "",
    "## Model Provenance",
    "",
    ...provenanceItems(record, brief),
    "",
  ].join("\n");
}

function buildActionPlan(session: AdvisorySession, record?: DecisionRecord, brief?: BoardBrief) {
  const title = topicTitle(session, record, brief);
  return [
    `# Action Plan: ${title}`,
    "",
    `**Recommendation:** ${record?.recommendation || brief?.recommendation || "No recommendation was extracted."}`,
    "",
    "## Ordered Next Steps",
    "",
    ...actionItems(record),
    "",
    "## Dependencies and Watchpoints",
    "",
    ...listItems(record?.openQuestions, "No dependencies or open questions were extracted."),
    "",
    "## Risks To Track",
    "",
    ...listItems(record?.risks || brief?.risks, "No explicit risks were extracted."),
    "",
    "## Follow-Up Checks",
    "",
    "- Confirm the selected path still matches the original decision criteria.",
    "- Assign a human owner for every action item before execution.",
    "- Revisit dissent and unresolved questions before irreversible work.",
    "",
  ].join("\n");
}

function buildRiskMemo(session: AdvisorySession, record?: DecisionRecord, brief?: BoardBrief) {
  const title = topicTitle(session, record, brief);
  const formal = record?.formalVerdict || brief?.formalVerdict;
  return [
    `# Risk Memo: ${title}`,
    "",
    ...metaItems([["Topic", topicValue(session, record, brief)]]),
    "",
    "## Primary Risks",
    "",
    ...listItems(record?.risks || brief?.risks, "No explicit risks were extracted."),
    "",
    "## Dissent and Minority Views",
    "",
    ...(record?.dissent?.length
      ? record.dissent.map((item) => `- ${item.agent}: ${item.summary}`)
      : listItems(brief?.dissent, "No explicit dissent was recorded.")),
    "",
    "## Could Not Verify",
    "",
    ...listItems(formal?.couldntVerify, "No could-not-verify items were extracted."),
    "",
    "## Mitigation Plan",
    "",
    ...actionItems(record),
    "",
    "## Open Questions",
    "",
    ...listItems(record?.openQuestions || formal?.open_questions, "No open questions were extracted."),
    "",
  ].join("\n");
}

function buildBoardBrief(session: AdvisorySession, record?: DecisionRecord, brief?: BoardBrief) {
  const title = topicTitle(session, record, brief);
  return [
    `# Board Brief: ${title}`,
    "",
    ...metaItems([
      ["Topic", topicValue(session, record, brief)],
      ["Mode", brief?.mode || record?.mode || session.mode],
      ["Generated", brief?.generatedAt || record?.generatedAt || new Date().toISOString()],
    ]),
    "",
    "## Decision",
    "",
    brief?.decision || record?.decision || "No final decision was extracted.",
    "",
    "## Recommendation",
    "",
    brief?.recommendation || record?.recommendation || "No recommendation was extracted.",
    "",
    "## Top Ideas",
    "",
    ...(brief?.topIdeas?.length
      ? brief.topIdeas.map((idea) => `- ${idea.rank ? `${idea.rank}. ` : ""}${idea.idea}${typeof idea.votes === "number" ? ` (${idea.votes} votes)` : ""}`)
      : record?.optionsConsidered?.length
        ? record.optionsConsidered.map((option) => `- ${option.title}${typeof option.votes === "number" ? ` (${option.votes} votes)` : ""}`)
        : ["- No ranked ideas were extracted."]),
    "",
    "## Key Risks",
    "",
    ...listItems(brief?.risks || record?.risks, "No explicit risks were extracted."),
    "",
    "## Action Items",
    "",
    ...(brief?.actionItems?.length ? brief.actionItems.map((item) => `- ${item}`) : actionItems(record)),
    "",
    "## Provenance",
    "",
    ...provenanceItems(record, brief),
    "",
  ].join("\n");
}

function buildFullArtifact(session: AdvisorySession, events: AdvisoryEvent[], record?: DecisionRecord) {
  if (record?.markdown?.trim()) return record.markdown;
  return formatMarkdownFileExport(session, events);
}

function buildArtifactDocument(
  kind: ArtifactKind,
  session: AdvisorySession,
  events: AdvisoryEvent[],
  payload: BriefPayload | null,
): ArtifactDocument {
  const record = payload?.decisionRecord || session.decisionRecord;
  const brief = payload?.brief || session.brief;
  const fallback = formatMarkdownFileExport(session, events);
  const definition = ARTIFACTS.find((item) => item.id === kind) || ARTIFACTS[0];
  const markdown = kind === "full-artifact"
    ? buildFullArtifact(session, events, record)
    : kind === "decision-memo"
      ? buildDecisionMemo(session, record, brief)
    : kind === "action-plan"
      ? buildActionPlan(session, record, brief)
      : kind === "risk-memo"
        ? buildRiskMemo(session, record, brief)
        : buildBoardBrief(session, record, brief);

  return {
    id: kind,
    title: definition.label,
    description: definition.description,
    markdown: normalizeArtifactMarkdown(markdown.trim() || fallback),
    fileStem: artifactStem(session, kind),
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function markdownToHtml(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  const paragraph: string[] = [];
  let listMode: "ul" | "ol" | null = null;

  const closeList = () => {
    if (!listMode) return;
    html.push(`</${listMode}>`);
    listMode = null;
  };

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph.length = 0;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(heading[1].length, 3);
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (listMode !== "ul") {
        closeList();
        html.push("<ul>");
        listMode = "ul";
      }
      html.push(`<li>${inlineMarkdown(unordered[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (listMode !== "ol") {
        closeList();
        html.push("<ol>");
        listMode = "ol";
      }
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(line);
  }

  flushParagraph();
  closeList();
  return html.join("\n");
}

function buildHtmlDocument(artifact: ArtifactDocument, session: AdvisorySession) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(artifact.title)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; background: #f8fafc !important; color: #1e293b !important; }
    body { padding: 24px 18px 40px; font-family: Georgia, "Times New Roman", Cambria, serif; font-size: 11px; line-height: 1.7; }
    main { max-width: 900px; margin: 0 auto; padding: 28px; background: #ffffff; box-shadow: 0 18px 60px rgba(15, 23, 42, 0.08); }
    .brand { margin-bottom: 8px; color: #6d28d9; font: 800 9px/1.3 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; letter-spacing: 2.5px; text-transform: uppercase; }
    .title { margin: 0 0 12px; color: #0f172a; font: 800 20px/1.3 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; letter-spacing: 0; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
    .chip { display: inline-flex; align-items: center; min-height: 22px; padding: 3px 10px; border: 1px solid #e2e8f0; border-radius: 4px; background: #f1f5f9; color: #475569; font: 700 9px/1.2 "SF Mono", "Fira Code", Consolas, monospace; }
    .artifact-content { color: #334155; }
    .artifact-content h1, .artifact-content h2, .artifact-content h3 { color: #0f172a; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; font-weight: 800; line-height: 1.35; }
    .artifact-content h1 { margin: 0 0 14px; font-size: 18px; }
    .artifact-content h2 { margin: 26px 0 10px; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #0f172a; font-size: 16px; }
    .artifact-content h3 { margin: 18px 0 8px; font-size: 14px; }
    .artifact-content p { margin: 0 0 10px; }
    .artifact-content ul, .artifact-content ol { margin: 6px 0 12px; padding-left: 20px; }
    .artifact-content li { margin: 0 0 5px; }
    .artifact-content strong { color: #0f172a; font-size: 1.02em; font-weight: 800; }
    .artifact-content em { color: #64748b; }
    .artifact-content code { padding: 1px 4px; border: 1px solid #e2e8f0; border-radius: 3px; background: #f8fafc; color: #475569; font: 10px/1.4 "SF Mono", Consolas, monospace; }
  </style>
</head>
<body>
  <main>
    <div class="brand">Panely Advisory Board</div>
    <h1 class="title">${escapeHtml(artifact.title)}</h1>
    <div class="meta">
      <span class="chip">${escapeHtml((session.completedAt || session.createdAt).slice(0, 10))}</span>
      <span class="chip">${escapeHtml(session.mode)}</span>
      <span class="chip">${escapeHtml(session.topic)}</span>
    </div>
    <div class="artifact-content">${markdownToHtml(artifact.markdown)}</div>
  </main>
</body>
</html>`;
}

function plainTextForPdf(markdown: string) {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "- ")
    .trim();
}

function wrapPdfLine(line: string, width: number) {
  if (!line.trim()) return [""];
  const words = line.replace(/\t/g, "  ").split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`;
    }
  }
  if (current) lines.push(current);
  return lines;
}

const PDF_TEXT_REPLACEMENTS: Record<string, string> = {
  "\u2013": "-",
  "\u2014": "-",
  "\u2018": "'",
  "\u2019": "'",
  "\u201c": "\"",
  "\u201d": "\"",
  "\u2022": "-",
  "\u2026": "...",
  "\u2192": "->",
};

function normalizePdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, (char) => PDF_TEXT_REPLACEMENTS[char] ?? "");
}

function pdfEscape(value: string) {
  return normalizePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function buildPdfBlob(artifact: ArtifactDocument) {
  const lines = plainTextForPdf(artifact.markdown)
    .split(/\r?\n/)
    .flatMap((line) => wrapPdfLine(line, 92));
  const pageSize = 58;
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += pageSize) {
    pages.push(lines.slice(index, index + pageSize));
  }
  if (pages.length === 0) pages.push(["No artifact content was available."]);

  const pageRefs = pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ");
  const objects: Array<{ id: number; body: string }> = [
    { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
    { id: 2, body: `<< /Type /Pages /Kids [ ${pageRefs} ] /Count ${pages.length} >>` },
    { id: 3, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>" },
    { id: 4, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>" },
  ];

  pages.forEach((pageLines, index) => {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    const title = index === 0 ? artifact.title : `${artifact.title} (continued)`;
    const textLines = [
      "BT",
      "/F2 8 Tf",
      "0.427 0.157 0.851 rg",
      "72 762 Td",
      "(PANELY ADVISORY BOARD) Tj",
      "/F2 15 Tf",
      "0.059 0.090 0.165 rg",
      "0 -20 Td",
      `(${pdfEscape(title)}) Tj`,
      "/F1 9 Tf",
      "0.118 0.161 0.231 rg",
      "0 -26 Td",
      "12 TL",
      ...pageLines.map((line) => line ? `(${pdfEscape(line)}) Tj T*` : "T*"),
      "ET",
    ];
    const content = textLines.join("\n");
    objects.push({
      id: pageId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
    });
    objects.push({
      id: contentId,
      body: `<< /Length ${utf8ByteLength(content)} >>\nstream\n${content}\nendstream`,
    });
  });

  let pdf = "";
  let byteOffset = 0;
  const offsets: number[] = [0];
  const appendPdf = (chunk: string) => {
    pdf += chunk;
    byteOffset += utf8ByteLength(chunk);
  };
  appendPdf("%PDF-1.4\n");
  for (const object of objects) {
    offsets[object.id] = byteOffset;
    appendPdf(`${object.id} 0 obj\n${object.body}\nendobj\n`);
  }
  const xrefStart = byteOffset;
  appendPdf(`xref\n0 ${objects.length + 1}\n`);
  appendPdf("0000000000 65535 f \n");
  for (let id = 1; id <= objects.length; id++) {
    appendPdf(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  appendPdf(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);
  return new Blob([pdf], { type: "application/pdf" });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openHtmlArtifact(artifact: ArtifactDocument, session: AdvisorySession) {
  const html = buildHtmlDocument(artifact, session);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function buildDownload(artifact: ArtifactDocument, session: AdvisorySession, format: ArtifactFormat) {
  if (format === "md") {
    return {
      blob: new Blob([artifact.markdown], { type: "text/markdown;charset=utf-8" }),
      fileName: `${artifact.fileStem}.md`,
    };
  }
  if (format === "html") {
    return {
      blob: new Blob([buildHtmlDocument(artifact, session)], { type: "text/html;charset=utf-8" }),
      fileName: `${artifact.fileStem}.html`,
    };
  }
  return {
    blob: buildPdfBlob(artifact),
    fileName: `${artifact.fileStem}.pdf`,
  };
}

export default function ArtifactsPanel({ open, session, events, onClose }: ArtifactsPanelProps) {
  const [selectedKind, setSelectedKind] = useState<ArtifactKind>("full-artifact");
  const [payload, setPayload] = useState<SessionBriefPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const activePayload = payload?.sessionId === session.id ? payload.value : null;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const sessionId = session.id;
    void Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return null;
        setPayload(null);
        setLoading(true);
        setError("");
        return fetch(`/api/advisory/sessions/${sessionId}/brief?fresh=1`, {
          cache: "no-store",
          signal: controller.signal,
        });
      })
      .then(async (res) => {
        if (!res) return;
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load artifacts.");
        setPayload({ sessionId, value: data });
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unable to load artifacts.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [open, session.id]);

  const artifact = useMemo(
    () => buildArtifactDocument(selectedKind, session, events, activePayload),
    [activePayload, events, selectedKind, session],
  );

  if (!open) return null;

  const handleDownload = (format: ArtifactFormat) => {
    const download = buildDownload(artifact, session, format);
    downloadBlob(download.blob, download.fileName);
  };

  return (
    <div className="artifact-overlay" role="dialog" aria-modal="true" aria-labelledby="artifact-panel-title">
      <div className="artifact-dialog">
        <header className="artifact-header">
          <div>
            <div className="artifact-kicker">Session outputs</div>
            <h2 id="artifact-panel-title">Artifacts</h2>
            <p>Open a polished output, then download it in the format you need.</p>
          </div>
          <button type="button" className="artifact-close" onClick={onClose} aria-label="Close artifacts">
            <X size={18} />
          </button>
        </header>

        <div className="artifact-body">
          <aside className="artifact-list" aria-label="Artifact types">
            {ARTIFACTS.map((item) => {
              const Icon = item.icon;
              const selected = item.id === selectedKind;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`artifact-card ${selected ? "selected" : ""}`}
                  onClick={() => setSelectedKind(item.id)}
                >
                  <span className="artifact-card-icon">
                    <Icon size={18} />
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              );
            })}
          </aside>

          <section className="artifact-preview">
            <div className="artifact-preview-toolbar">
              <div>
                <div className="artifact-preview-label">{artifact.title}</div>
                <div className="artifact-preview-subtitle">{artifact.description}</div>
              </div>
              <div className="artifact-toolbar-actions">
                <button type="button" className="artifact-open-button" onClick={() => openHtmlArtifact(artifact, session)}>
                  <ExternalLink size={14} />
                  Open
                </button>
                {session.mode === "formal-board" && (
                  <a
                    className="artifact-run-files"
                    href={`/api/advisory/sessions/${session.id}/formal-artifacts`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText size={13} />
                    Run files
                  </a>
                )}
                <div className="artifact-downloads" aria-label="Download artifact">
                  {(["pdf", "html", "md"] as const).map((format) => (
                    <button key={format} type="button" onClick={() => handleDownload(format)}>
                      <Download size={13} />
                      {format.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {(loading || error) && (
              <div className={`artifact-status ${error ? "error" : ""}`}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                <span>{loading ? "Preparing current artifacts..." : error}</span>
              </div>
            )}

            <article className="artifact-document">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact.markdown}</ReactMarkdown>
            </article>
          </section>
        </div>
      </div>
    </div>
  );
}
