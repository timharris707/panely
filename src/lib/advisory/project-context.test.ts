import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildProjectContext,
  PROJECT_CONTEXT_LIMITS,
  validateProjectRoot,
} from "./project-context.ts";

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "panely-project-context-"));
  fs.mkdirSync(path.join(root, "src", "app"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "lib"), { recursive: true });
  fs.mkdirSync(path.join(root, "node_modules", "pkg"), { recursive: true });
  fs.mkdirSync(path.join(root, "dist"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  fs.writeFileSync(path.join(root, "README.md"), "# Fixture\n\nLocal project fixture.");
  fs.writeFileSync(path.join(root, "src", "app", "checkout.ts"), "export function checkout(total: number) { return total + 1; }\n");
  fs.writeFileSync(path.join(root, "src", "app", "checkout.test.ts"), "import { checkout } from './checkout';\ncheckout(1);\n");
  fs.writeFileSync(path.join(root, "src", "lib", "billing.ts"), "export const billingState = 'broken';\n");
  fs.writeFileSync(path.join(root, ".env"), "SECRET=do-not-read\n");
  fs.writeFileSync(path.join(root, "node_modules", "pkg", "index.ts"), "should not scan\n");
  fs.writeFileSync(path.join(root, "dist", "bundle.js"), "generated\n");
  fs.symlinkSync(path.join(os.tmpdir()), path.join(root, "tmp-link"));
  return root;
}

test("buildProjectContext selects relevant files and redacts the absolute root", () => {
  const root = makeFixture();
  const result = buildProjectContext({
    projectPath: root,
    topic: "checkout.ts is failing around billing totals. Review src/app/checkout.ts and the test.",
    contextBudgetChars: 20_000,
  });

  assert.equal(result.projectLabel, `[local-project:${path.basename(root)}]`);
  assert.ok(result.selectedFiles.some((file) => file.path === "src/app/checkout.ts"));
  assert.ok(result.selectedFiles.some((file) => file.path === "src/app/checkout.test.ts"));
  assert.ok(result.selectedFiles.some((file) => file.path === "package.json"));
  assert.equal(result.referenceContext.includes(root), false);
  assert.equal(result.referenceContext.includes("src/app/checkout.ts"), true);
  assert.equal(result.referenceContext.length <= result.budgetChars, true);
});

test("buildProjectContext skips secrets, generated directories, and symlinks", () => {
  const root = makeFixture();
  const result = buildProjectContext({
    projectPath: root,
    topic: "debug checkout",
    contextBudgetChars: 20_000,
  });

  assert.equal(result.selectedFiles.some((file) => file.path.includes("node_modules")), false);
  assert.equal(result.selectedFiles.some((file) => file.path === ".env"), false);
  assert.equal(result.referenceContext.includes("SECRET=do-not-read"), false);
  assert.ok(result.warnings.some((warning) => warning.code === "skipped-file" && warning.path === ".env"));
  assert.ok(result.warnings.some((warning) => warning.code === "skipped-symlink" && warning.path === "tmp-link"));
});

test("buildProjectContext preserves manifest and warnings under tight budget", () => {
  const root = makeFixture();
  fs.writeFileSync(path.join(root, "src", "app", "large.ts"), "x".repeat(PROJECT_CONTEXT_LIMITS.maxFileBytes));
  const result = buildProjectContext({
    projectPath: root,
    topic: "large.ts checkout failure " + "details ".repeat(200),
    contextBudgetChars: 2_200,
  });

  assert.equal(result.referenceContext.length <= result.budgetChars, true);
  assert.match(result.referenceContext, /# Selected File Manifest/);
  assert.match(result.referenceContext, /# Warnings/);
  assert.ok(result.truncated);
});

test("buildProjectContext enforces scan limits", () => {
  const root = makeFixture();
  for (let index = 0; index < PROJECT_CONTEXT_LIMITS.maxCandidateFiles + 30; index++) {
    fs.writeFileSync(path.join(root, "src", `many-${index}.ts`), `export const value${index} = ${index};\n`);
  }
  const result = buildProjectContext({
    projectPath: root,
    topic: "many checkout",
    contextBudgetChars: 50_000,
  });

  assert.ok(result.candidateFileCount <= PROJECT_CONTEXT_LIMITS.maxCandidateFiles);
  assert.ok(result.warnings.some((warning) => warning.code === "scan-limit"));
});

test("validateProjectRoot rejects dangerous roots and invalid paths", () => {
  assert.throws(() => validateProjectRoot("relative/path"), /absolute local path/);
  assert.throws(() => validateProjectRoot(path.parse(process.cwd()).root), /Refusing to scan/);
  assert.throws(() => validateProjectRoot(os.homedir()), /Refusing to scan/);
});

test("validateProjectRoot rejects symlink roots", () => {
  const root = makeFixture();
  const link = path.join(os.tmpdir(), `panely-project-link-${Date.now()}`);
  fs.symlinkSync(root, link);
  try {
    assert.throws(() => validateProjectRoot(link), /symlink/);
  } finally {
    fs.rmSync(link, { force: true });
  }
});
