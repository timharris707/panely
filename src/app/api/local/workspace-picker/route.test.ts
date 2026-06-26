import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "./route.ts";

test("workspace picker requires explicit same-origin local request", async () => {
  const missingHeader = await POST(new Request("http://localhost:3000/api/local/workspace-picker", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
    },
  }));
  assert.equal(missingHeader.status, 403);

  const crossSite = await POST(new Request("http://localhost:3000/api/local/workspace-picker", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "https://example.com",
      "x-panely-local-workspace-picker": "1",
    },
  }));
  assert.equal(crossSite.status, 403);

  const noOrigin = await POST(new Request("http://localhost:3000/api/local/workspace-picker", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      "x-panely-local-workspace-picker": "1",
    },
  }));
  assert.equal(noOrigin.status, 403);
});
