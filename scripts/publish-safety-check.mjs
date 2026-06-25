#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = spawnSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).stdout.trim() || process.cwd();

const protectedPathRules = [
  [/^data\/advisory\/.*\.json$/i, "local-session-json", "Local advisory session JSON must not be published."],
  [/^data\/.*\.sqlite(?:-(?:shm|wal))?$/i, "local-sqlite", "Local SQLite data must not be published."],
  [/^data\/advisory\/(?:exports|packets|briefs|formal-runs)\//i, "local-advisory-artifact", "Generated advisory artifacts are local by default."],
  [/^docs\/source-material\//i, "source-material", "Source material packets may contain private context."],
  [/(?:^|\/)\.env(?:\.|$)/i, "env-file", "Environment files may contain secrets."],
  [/\.pem$/i, "private-key", "Private key files must not be published."],
  [/(?:source|repo|reference|context)-?packet.*\.(?:txt|md|json)$/i, "source-packet", "Generated source/context packets may contain private material."],
];

const contentRules = [
  [/sk-[A-Za-z0-9_-]{20,}/, "openai-key-like-token", "Potential OpenAI-style API key found.", "error"],
  [/(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY)\s*=\s*\S+/i, "api-key-env-assignment", "Potential API key environment assignment found.", "error"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private-key-content", "Private key material found.", "error"],
  [/\/Users\/[^/\s]+\/(?:\.codex|\.openclaw|\.ssh|\.aws)\//, "private-home-config-path", "Private local config path found.", "warning"],
  [/\/Users\/[^/\s]+\/[^\s<>"')]+/, "local-home-path", "Developer-specific local path found. Generalize it before publishing.", "warning"],
];

function git(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return result.status === 0 ? result.stdout.split("\n").map((line) => line.trim()).filter(Boolean) : [];
}

function isProbablyTextFile(file) {
  const ext = path.extname(file).toLowerCase();
  return ![".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".sqlite", ".lock"].includes(ext);
}

const files = Array.from(new Set([...git(["ls-files", "--cached"]), ...git(["ls-files", "--others", "--exclude-standard"])]))
  .sort()
  .filter((file) => fs.existsSync(path.join(repoRoot, file)) && fs.statSync(path.join(repoRoot, file)).isFile());

const findings = [];
for (const file of files) {
  const isPublicEnvTemplate = /(?:^|\/)\.env\.(?:example|sample)$/i.test(file);
  for (const [pattern, rule, detail] of protectedPathRules) {
    if (rule === "env-file" && isPublicEnvTemplate) continue;
    if (pattern.test(file)) findings.push({ severity: "error", path: file, rule, detail });
  }

  const fullPath = path.join(repoRoot, file);
  if (!isProbablyTextFile(file) || fs.statSync(fullPath).size > 2 * 1024 * 1024) continue;
  let content = "";
  try {
    content = fs.readFileSync(fullPath, "utf8");
  } catch {
    continue;
  }
  for (const [pattern, rule, detail, severity] of contentRules) {
    if (pattern.test(content)) findings.push({ severity, path: file, rule, detail });
  }
}

const errors = findings.filter((finding) => finding.severity === "error");
if (findings.length === 0) {
  console.log(`Publish safety check passed. Scanned ${files.length} files.`);
  process.exit(0);
}

for (const finding of findings) {
  console.log(`${finding.severity.toUpperCase()} ${finding.path} [${finding.rule}] ${finding.detail}`);
}
if (errors.length > 0) {
  console.error(`Publish safety check failed with ${errors.length} error(s).`);
  process.exit(1);
}
console.log(`Publish safety check passed with ${findings.length} warning(s).`);
