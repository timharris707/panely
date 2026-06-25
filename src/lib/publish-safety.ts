import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

export type PublishSafetySeverity = "error" | "warning";

export interface PublishSafetyFinding {
  severity: PublishSafetySeverity;
  path: string;
  rule: string;
  detail: string;
}

export interface PublishSafetyReport {
  ok: boolean;
  checkedAt: string;
  repoRoot: string;
  scannedFiles: number;
  findings: PublishSafetyFinding[];
}

const PROTECTED_PATH_RULES: Array<{ pattern: RegExp; rule: string; detail: string }> = [
  { pattern: /^data\/advisory\/.*\.json$/i, rule: "local-session-json", detail: "Local advisory session JSON must not be published." },
  { pattern: /^data\/.*\.sqlite(?:-(?:shm|wal))?$/i, rule: "local-sqlite", detail: "Local SQLite data must not be published." },
  { pattern: /^data\/advisory\/(?:exports|packets|briefs)\//i, rule: "local-advisory-artifact", detail: "Generated advisory artifacts are local by default." },
  { pattern: /^docs\/source-material\//i, rule: "source-material", detail: "Source material packets may contain private context." },
  { pattern: /(?:^|\/)\.env(?:\.|$)/i, rule: "env-file", detail: "Environment files may contain secrets." },
  { pattern: /\.pem$/i, rule: "private-key", detail: "Private key files must not be published." },
  { pattern: /(?:source|repo|reference|context)-?packet.*\.(?:txt|md|json)$/i, rule: "source-packet", detail: "Generated source/context packets may contain private material." },
];

const CONTENT_RULES: Array<{ pattern: RegExp; rule: string; detail: string; severity: PublishSafetySeverity }> = [
  { pattern: /sk-[A-Za-z0-9_-]{20,}/, rule: "openai-key-like-token", detail: "Potential OpenAI-style API key found.", severity: "error" },
  { pattern: /(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY)\s*=\s*\S+/i, rule: "api-key-env-assignment", detail: "Potential API key environment assignment found.", severity: "error" },
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, rule: "private-key-content", detail: "Private key material found.", severity: "error" },
  { pattern: /\/Users\/[^/\s]+\/(?:\.codex|\.openclaw|\.ssh|\.aws)\//, rule: "private-home-config-path", detail: "Private local config path found.", severity: "warning" },
];

function runGit(repoRoot: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) return [];
  return result.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort();
}

function listPublishCandidateFiles(repoRoot: string) {
  return unique([
    ...runGit(repoRoot, ["ls-files", "--cached"]),
    ...runGit(repoRoot, ["ls-files", "--others", "--exclude-standard"]),
  ]).filter((file) => {
    const fullPath = path.join(repoRoot, file);
    if (!fs.existsSync(fullPath)) return false;
    const stat = fs.statSync(fullPath);
    return stat.isFile();
  });
}

function isProbablyTextFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".sqlite", ".lock"].includes(ext)) return false;
  return true;
}

export function scanPublishSafety(repoRoot = process.cwd()): PublishSafetyReport {
  const files = listPublishCandidateFiles(repoRoot);
  const findings: PublishSafetyFinding[] = [];

  for (const file of files) {
    const isPublicEnvTemplate = /(?:^|\/)\.env\.(?:example|sample)$/i.test(file);
    for (const rule of PROTECTED_PATH_RULES) {
      if (rule.rule === "env-file" && isPublicEnvTemplate) continue;
      if (rule.pattern.test(file)) {
        findings.push({ severity: "error", path: file, rule: rule.rule, detail: rule.detail });
      }
    }

    const fullPath = path.join(repoRoot, file);
    if (!isProbablyTextFile(file) || fs.statSync(fullPath).size > 2 * 1024 * 1024) continue;

    let content = "";
    try {
      content = fs.readFileSync(fullPath, "utf8");
    } catch {
      continue;
    }

    for (const rule of CONTENT_RULES) {
      if (rule.pattern.test(content)) {
        findings.push({ severity: rule.severity, path: file, rule: rule.rule, detail: rule.detail });
      }
    }
  }

  return {
    ok: findings.every((finding) => finding.severity !== "error"),
    checkedAt: new Date().toISOString(),
    repoRoot,
    scannedFiles: files.length,
    findings,
  };
}
