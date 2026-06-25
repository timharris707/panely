import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { POST } from "./route.ts";

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "panely-project-api-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "fixture" }));
  fs.writeFileSync(path.join(root, "src", "bug.ts"), "export const broken = true;\n");
  return root;
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/advisory/project-context", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
      "x-panely-local-project-scan": "1",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test("project context endpoint returns a redacted local packet", async () => {
  const root = makeProject();
  const response = await POST(request({
    projectPath: root,
    topic: "bug.ts has a broken export",
    contextBudgetChars: 12_000,
  }));
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.projectContext.referenceContext.includes(root), false);
  assert.equal(data.projectContext.referenceContext.includes("src/bug.ts"), true);
  assert.ok(data.projectContext.selectedFiles.length >= 1);
});

test("project context endpoint rejects missing explicit local header", async () => {
  const response = await POST(request({ projectPath: makeProject(), topic: "bug" }, { "x-panely-local-project-scan": "0" }));
  assert.equal(response.status, 403);
});

test("project context endpoint rejects cross-site fetches", async () => {
  const response = await POST(request(
    { projectPath: makeProject(), topic: "bug" },
    { origin: "https://example.com", "sec-fetch-site": "cross-site" }
  ));
  assert.equal(response.status, 403);
});

test("project context endpoint rejects non-loopback hosts", async () => {
  const response = await POST(request(
    { projectPath: makeProject(), topic: "bug" },
    { host: "panely.example.com", origin: "https://panely.example.com" }
  ));
  assert.equal(response.status, 403);
});

test("project context endpoint returns validation errors as 400", async () => {
  const response = await POST(request({ projectPath: "relative/path", topic: "bug" }));
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.match(data.error, /absolute local path/);
});
