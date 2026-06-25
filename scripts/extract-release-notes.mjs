#!/usr/bin/env node
import fs from "node:fs";

function usage() {
  console.error("Usage: node scripts/extract-release-notes.mjs <vX.Y.Z> [--changelog CHANGELOG.md] [--output release-notes.md] [--github-output PATH]");
}

function parseArgs(argv) {
  const args = { tag: argv[2], changelog: "CHANGELOG.md", output: "release-notes.md", githubOutput: undefined };
  for (let index = 3; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--changelog") args.changelog = argv[++index];
    else if (arg === "--output") args.output = argv[++index];
    else if (arg === "--github-output") args.githubOutput = argv[++index];
    else {
      usage();
      process.exit(2);
    }
  }
  return args;
}

function appendGithubOutput(path, found) {
  if (!path) return;
  fs.appendFileSync(path, `found=${found ? "true" : "false"}\n`);
}

export function extractReleaseNotes({ tag, changelogPath = "CHANGELOG.md" }) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag || "")) {
    throw new Error(`Release tag must use semver format vX.Y.Z. Got: ${tag || "(missing)"}`);
  }
  if (!fs.existsSync(changelogPath)) return null;

  const lines = fs.readFileSync(changelogPath, "utf8").split(/\r?\n/);
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingPattern = new RegExp(`^## \\[${escapedTag}\\](?:\\s|$)`);
  const start = lines.findIndex((line) => headingPattern.test(line));
  if (start === -1) return null;

  const endOffset = lines.slice(start + 1).findIndex((line) => /^## \[/.test(line));
  const end = endOffset === -1 ? lines.length : start + 1 + endOffset;
  const section = lines.slice(start + 1, end).join("\n").trim();
  return section || null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv);
  try {
    const notes = extractReleaseNotes({ tag: args.tag, changelogPath: args.changelog });
    appendGithubOutput(args.githubOutput, Boolean(notes));
    if (notes) {
      fs.writeFileSync(args.output, `${notes}\n`);
      process.stdout.write(`${args.output}\n`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}
