import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const PROJECT_CONTEXT_LIMITS = {
  maxDepth: 12,
  maxCandidateFiles: 900,
  maxDirs: 260,
  maxBytesRead: 1_200_000,
  maxSelectedFiles: 24,
  maxScanMs: 2500,
  maxWarnings: 40,
  maxFileBytes: 180_000,
  minBudgetChars: 2_000,
  defaultBudgetChars: 50_000,
} as const;

type WarningCode =
  | "dangerous-root"
  | "invalid-root"
  | "scan-limit"
  | "skipped-directory"
  | "skipped-file"
  | "skipped-symlink"
  | "budget-truncated"
  | "read-error";

export interface ProjectContextWarning {
  code: WarningCode;
  message: string;
  path?: string;
}

export interface ProjectContextSelectedFile {
  path: string;
  size: number;
  score: number;
  reasons: string[];
  truncated: boolean;
  includedChars: number;
}

export interface ProjectContextResult {
  projectLabel: string;
  rootName: string;
  selectedFiles: ProjectContextSelectedFile[];
  candidateFileCount: number;
  scannedDirCount: number;
  skippedFileCount: number;
  skippedDirCount: number;
  warnings: ProjectContextWarning[];
  referenceContext: string;
  referenceContextChars: number;
  budgetChars: number;
  truncated: boolean;
}

interface CandidateFile {
  absPath: string;
  relPath: string;
  size: number;
  score: number;
  reasons: string[];
}

const EXCLUDED_DIR_NAMES = new Set([
  ".git",
  ".hg",
  ".svn",
  ".next",
  ".turbo",
  ".vercel",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".cache",
  ".parcel-cache",
  "target",
  ".pytest_cache",
  "__pycache__",
  ".venv",
  "venv",
  ".idea",
  ".vscode",
]);

const SECRET_FILE_PATTERNS = [
  /^\.env(?:\.|$)/i,
  /^\.npmrc$/i,
  /^\.pypirc$/i,
  /^id_rsa/i,
  /^id_ed25519/i,
  /credential/i,
  /secret/i,
  /private[-_]?key/i,
];

const TEXT_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cfg",
  ".conf",
  ".cpp",
  ".css",
  ".csv",
  ".go",
  ".graphql",
  ".h",
  ".hpp",
  ".htm",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".md",
  ".mdx",
  ".mjs",
  ".py",
  ".rb",
  ".rs",
  ".scss",
  ".sh",
  ".sql",
  ".swift",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".vue",
  ".xml",
  ".yaml",
  ".yml",
]);

const KEY_FILENAMES = new Set([
  "agents.md",
  "dockerfile",
  "eslint.config.js",
  "eslint.config.mjs",
  "jest.config.js",
  "makefile",
  "next.config.js",
  "next.config.mjs",
  "package.json",
  "playwright.config.ts",
  "pnpm-lock.yaml",
  "readme.md",
  "tsconfig.json",
  "vite.config.ts",
]);

function normalizeRelPath(value: string) {
  return value.split(path.sep).join("/");
}

function safeWarningPath(root: string, absPath: string) {
  const rel = normalizeRelPath(path.relative(root, absPath));
  return rel && !rel.startsWith("..") ? rel : undefined;
}

function warningList() {
  const warnings: ProjectContextWarning[] = [];
  return {
    warnings,
    add(warning: ProjectContextWarning) {
      if (warnings.length >= PROJECT_CONTEXT_LIMITS.maxWarnings) return;
      warnings.push(warning);
    },
  };
}

function isDangerousRoot(realRoot: string, homeDir = os.homedir()) {
  const normalizedRoot = path.resolve(realRoot);
  const normalizedHome = path.resolve(homeDir);
  if (normalizedRoot === path.parse(normalizedRoot).root) return true;
  if (normalizedRoot === normalizedHome) return true;
  const denied = [
    ".aws",
    ".config",
    ".codex",
    ".gnupg",
    ".ssh",
    ".kube",
    ".npm",
    ".docker",
  ].map((dir) => path.join(normalizedHome, dir));
  return denied.some((dir) => normalizedRoot === dir || normalizedRoot.startsWith(`${dir}${path.sep}`));
}

export function validateProjectRoot(projectPath: string, homeDir = os.homedir()) {
  if (!path.isAbsolute(projectPath)) {
    throw new Error("Project path must be an absolute local path.");
  }
  let lstat: fs.Stats;
  try {
    lstat = fs.lstatSync(projectPath);
  } catch {
    throw new Error("Project path does not exist.");
  }
  if (lstat.isSymbolicLink()) {
    throw new Error("Project root cannot be a symlink.");
  }
  if (!lstat.isDirectory()) {
    throw new Error("Project path must be a directory.");
  }
  const realRoot = fs.realpathSync(projectPath);
  if (isDangerousRoot(realRoot, homeDir)) {
    throw new Error("Refusing to scan this root because it can expose private credentials or too much of the machine.");
  }
  return realRoot;
}

function isSecretLikeFile(name: string) {
  return SECRET_FILE_PATTERNS.some((pattern) => pattern.test(name));
}

function isTextCandidate(filePath: string) {
  const lowerName = path.basename(filePath).toLowerCase();
  if (KEY_FILENAMES.has(lowerName)) return true;
  return TEXT_EXTENSIONS.has(path.extname(lowerName));
}

function termsFromTopic(topic: string) {
  return Array.from(new Set(
    topic
      .toLowerCase()
      .split(/[^a-z0-9_./-]+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3 && !["the", "and", "this", "that", "with", "from", "error", "issue", "bug"].includes(term))
  )).slice(0, 80);
}

function pathMentionsFromTopic(topic: string) {
  return Array.from(new Set(
    Array.from(topic.matchAll(/[A-Za-z0-9_.@/-]+\.(?:ts|tsx|js|jsx|mjs|json|md|py|go|rs|css|html|yml|yaml|toml)/g))
      .map((match) => match[0].replace(/^\.?\//, "").toLowerCase())
  ));
}

function scoreFile(relPath: string, size: number, topicTerms: string[], pathMentions: string[]) {
  const lower = relPath.toLowerCase();
  const name = path.basename(lower);
  const reasons: string[] = [];
  let score = 0;

  if (KEY_FILENAMES.has(name)) {
    score += 55;
    reasons.push("project metadata");
  }
  if (/(^|\/)(src|app|lib|components|pages|server|api)\//.test(lower)) {
    score += 16;
    reasons.push("source path");
  }
  if (/(test|spec)\.(ts|tsx|js|jsx|py|go|rs)$/.test(lower) || /(^|\/)(__tests__|tests?)\//.test(lower)) {
    score += 14;
    reasons.push("test path");
  }
  for (const mention of pathMentions) {
    if (lower.endsWith(mention) || lower.includes(mention)) {
      score += 90;
      reasons.push("mentioned in prompt");
      break;
    }
  }
  const matchedTerms = topicTerms.filter((term) => lower.includes(term)).slice(0, 5);
  if (matchedTerms.length) {
    score += matchedTerms.length * 12;
    reasons.push(`matches ${matchedTerms.join(", ")}`);
  }
  if (size <= 20_000) score += 8;
  if (size > PROJECT_CONTEXT_LIMITS.maxFileBytes) {
    score -= 50;
    reasons.push("large file");
  }
  return {
    score,
    reasons: reasons.length ? Array.from(new Set(reasons)) : ["text candidate"],
  };
}

function appendWithBudget(parts: string[], text: string, remaining: { chars: number }) {
  if (remaining.chars <= 0) return { included: 0, truncated: text.length > 0 };
  if (text.length <= remaining.chars) {
    parts.push(text);
    remaining.chars -= text.length;
    return { included: text.length, truncated: false };
  }
  const marker = "\n\n[Truncated by Panely context budget]\n";
  const sliceLength = Math.max(0, remaining.chars - marker.length);
  parts.push(`${text.slice(0, sliceLength)}${marker}`);
  const included = remaining.chars;
  remaining.chars = 0;
  return { included, truncated: true };
}

function readCandidateContents(candidates: CandidateFile[], budgetChars: number, warnings: ReturnType<typeof warningList>) {
  const selected: ProjectContextSelectedFile[] = [];
  const contents = new Map<string, string>();
  let bytesRead = 0;

  for (const candidate of candidates.slice(0, PROJECT_CONTEXT_LIMITS.maxSelectedFiles)) {
    if (bytesRead >= PROJECT_CONTEXT_LIMITS.maxBytesRead) {
      warnings.add({ code: "scan-limit", message: "Stopped reading file contents after byte-read limit." });
      break;
    }
    const maxRead = Math.min(candidate.size, PROJECT_CONTEXT_LIMITS.maxFileBytes, PROJECT_CONTEXT_LIMITS.maxBytesRead - bytesRead);
    try {
      const buffer = Buffer.alloc(maxRead);
      const fd = fs.openSync(candidate.absPath, "r");
      let bytesActuallyRead = 0;
      try {
        bytesActuallyRead = fs.readSync(fd, buffer, 0, maxRead, 0);
      } finally {
        fs.closeSync(fd);
      }
      const text = buffer.subarray(0, bytesActuallyRead).toString("utf8");
      bytesRead += bytesActuallyRead;
      contents.set(candidate.relPath, text);
      selected.push({
        path: candidate.relPath,
        size: candidate.size,
        score: candidate.score,
        reasons: candidate.reasons,
        truncated: candidate.size > bytesActuallyRead,
        includedChars: 0,
      });
    } catch {
      warnings.add({ code: "read-error", message: "Could not read selected file.", path: candidate.relPath });
    }
    if (budgetChars <= PROJECT_CONTEXT_LIMITS.minBudgetChars && selected.length >= 4) break;
  }

  return { selected, contents };
}

function buildPacket(input: {
  projectLabel: string;
  rootName: string;
  topic: string;
  selected: ProjectContextSelectedFile[];
  contents: Map<string, string>;
  warnings: ProjectContextWarning[];
  budgetChars: number;
  stats: { candidateFileCount: number; scannedDirCount: number; skippedFileCount: number; skippedDirCount: number };
}) {
  const budgetChars = Math.max(PROJECT_CONTEXT_LIMITS.minBudgetChars, Math.trunc(input.budgetChars || PROJECT_CONTEXT_LIMITS.defaultBudgetChars));
  const topicBudget = Math.min(1800, Math.max(400, Math.floor(budgetChars * 0.18)));
  const preamble = [
    "# Local Project Debug Packet",
    "",
    `Project: ${input.projectLabel}`,
    `Root label: ${input.rootName}`,
    "Absolute local path: redacted by Panely",
    "",
    "Use this packet to diagnose the developer's issue. Return root cause hypotheses, evidence, likely files, a fix strategy, and a test plan. Do not assume omitted files were irrelevant.",
    "",
    "# Scan Summary",
    `Candidate files: ${input.stats.candidateFileCount}`,
    `Scanned directories: ${input.stats.scannedDirCount}`,
    `Skipped files: ${input.stats.skippedFileCount}`,
    `Skipped directories: ${input.stats.skippedDirCount}`,
    "",
    "# Selected File Manifest",
    ...input.selected.map((file, index) => `${index + 1}. ${file.path} (${file.size} bytes; ${file.reasons.join("; ")})`),
    "",
    "# Warnings",
    ...(input.warnings.length ? input.warnings.map((warning) => `- ${warning.path ? `${warning.path}: ` : ""}${warning.message}`) : ["- None"]),
    "",
    "# Developer Pain Point",
    input.topic.trim().slice(0, topicBudget) || "No pain point provided.",
    "",
    "# Selected File Contents",
    "",
  ].join("\n");

  const parts: string[] = [];
  const remaining = { chars: budgetChars };
  const preambleResult = appendWithBudget(parts, preamble, remaining);
  let truncated = preambleResult.truncated;
  const selected = input.selected.map((file) => ({ ...file }));

  for (const file of selected) {
    if (remaining.chars <= 0) {
      truncated = true;
      file.truncated = true;
      continue;
    }
    const content = input.contents.get(file.path) ?? "";
    const fileBlock = [
      `## ${file.path}`,
      `Reason: ${file.reasons.join("; ")}`,
      "```",
      content,
      "```",
      "",
    ].join("\n");
    const result = appendWithBudget(parts, fileBlock, remaining);
    file.includedChars = result.included;
    file.truncated = file.truncated || result.truncated;
    truncated = truncated || result.truncated;
  }

  let referenceContext = parts.join("");
  if (referenceContext.length > budgetChars) {
    referenceContext = referenceContext.slice(0, budgetChars);
    truncated = true;
  }
  return { referenceContext, selected, truncated };
}

export function buildProjectContext(input: {
  projectPath: string;
  topic: string;
  contextBudgetChars?: number;
  now?: number;
}) {
  const startedAt = input.now ?? Date.now();
  const root = validateProjectRoot(input.projectPath);
  const rootName = path.basename(root) || "project";
  const projectLabel = `[local-project:${rootName}]`;
  const topicTerms = termsFromTopic(input.topic);
  const pathMentions = pathMentionsFromTopic(input.topic);
  const warnings = warningList();
  const candidates: CandidateFile[] = [];
  const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];
  let scannedDirCount = 0;
  let skippedDirCount = 0;
  let skippedFileCount = 0;

  while (queue.length > 0) {
    if (Date.now() - startedAt > PROJECT_CONTEXT_LIMITS.maxScanMs) {
      warnings.add({ code: "scan-limit", message: "Stopped scanning after time limit." });
      break;
    }
    if (candidates.length >= PROJECT_CONTEXT_LIMITS.maxCandidateFiles) {
      warnings.add({ code: "scan-limit", message: "Stopped scanning after candidate file limit." });
      break;
    }
    if (scannedDirCount >= PROJECT_CONTEXT_LIMITS.maxDirs) {
      warnings.add({ code: "scan-limit", message: "Stopped scanning after directory limit." });
      break;
    }
    const current = queue.shift();
    if (!current) break;
    scannedDirCount++;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current.dir, { withFileTypes: true });
    } catch {
      warnings.add({ code: "read-error", message: "Could not read directory.", path: safeWarningPath(root, current.dir) });
      continue;
    }

    for (const entry of entries) {
      if (candidates.length >= PROJECT_CONTEXT_LIMITS.maxCandidateFiles) {
        warnings.add({ code: "scan-limit", message: "Stopped scanning after candidate file limit." });
        break;
      }
      const absPath = path.join(current.dir, entry.name);
      const relPath = normalizeRelPath(path.relative(root, absPath));
      if (entry.isSymbolicLink()) {
        warnings.add({ code: "skipped-symlink", message: "Skipped symlink.", path: relPath });
        continue;
      }
      if (entry.isDirectory()) {
        if (current.depth >= PROJECT_CONTEXT_LIMITS.maxDepth || EXCLUDED_DIR_NAMES.has(entry.name.toLowerCase())) {
          skippedDirCount++;
          warnings.add({ code: "skipped-directory", message: "Skipped directory.", path: relPath });
          continue;
        }
        queue.push({ dir: absPath, depth: current.depth + 1 });
        continue;
      }
      if (!entry.isFile()) continue;
      if (isSecretLikeFile(entry.name)) {
        skippedFileCount++;
        warnings.add({ code: "skipped-file", message: "Skipped secret-like file.", path: relPath });
        continue;
      }
      let stat: fs.Stats;
      try {
        stat = fs.statSync(absPath);
      } catch {
        skippedFileCount++;
        warnings.add({ code: "read-error", message: "Could not stat file.", path: relPath });
        continue;
      }
      if (!isTextCandidate(absPath)) {
        skippedFileCount++;
        continue;
      }
      if (stat.size > PROJECT_CONTEXT_LIMITS.maxFileBytes * 4) {
        skippedFileCount++;
        warnings.add({ code: "skipped-file", message: "Skipped very large text file.", path: relPath });
        continue;
      }
      let realFile: string;
      try {
        realFile = fs.realpathSync(absPath);
      } catch {
        skippedFileCount++;
        warnings.add({ code: "read-error", message: "Could not resolve file realpath.", path: relPath });
        continue;
      }
      if (!realFile.startsWith(`${root}${path.sep}`)) {
        skippedFileCount++;
        warnings.add({ code: "skipped-file", message: "Skipped file outside project root.", path: relPath });
        continue;
      }
      const scored = scoreFile(relPath, stat.size, topicTerms, pathMentions);
      candidates.push({ absPath, relPath, size: stat.size, score: scored.score, reasons: scored.reasons });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.relPath.localeCompare(b.relPath));
  const budgetChars = Math.max(PROJECT_CONTEXT_LIMITS.minBudgetChars, Math.trunc(input.contextBudgetChars || PROJECT_CONTEXT_LIMITS.defaultBudgetChars));
  const { selected, contents } = readCandidateContents(candidates, budgetChars, warnings);
  const packet = buildPacket({
    projectLabel,
    rootName,
    topic: input.topic,
    selected,
    contents,
    warnings: warnings.warnings,
    budgetChars,
    stats: { candidateFileCount: candidates.length, scannedDirCount, skippedFileCount, skippedDirCount },
  });

  if (packet.truncated) {
    warnings.add({ code: "budget-truncated", message: "Project packet was truncated to fit the selected context budget." });
  }

  return {
    projectLabel,
    rootName,
    selectedFiles: packet.selected,
    candidateFileCount: candidates.length,
    scannedDirCount,
    skippedFileCount,
    skippedDirCount,
    warnings: warnings.warnings,
    referenceContext: packet.referenceContext,
    referenceContextChars: packet.referenceContext.length,
    budgetChars,
    truncated: packet.truncated,
  } satisfies ProjectContextResult;
}
