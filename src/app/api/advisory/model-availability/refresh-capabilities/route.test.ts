import assert from "node:assert/strict";
import test from "node:test";
import { allowsLocalRefresh } from "../../../../../lib/ai/local-refresh-request.ts";

test("model capability refresh requires explicit browser same-origin evidence", async () => {
  const missingHeader = new Request("http://localhost:3000/api/advisory/model-availability/refresh-capabilities", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
    },
  });
  assert.equal(allowsLocalRefresh(missingHeader), false);

  const noOriginOrReferer = new Request("http://localhost:3000/api/advisory/model-availability/refresh-capabilities", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      "x-panely-local-update": "1",
      "sec-fetch-site": "same-origin",
    },
  });
  assert.equal(allowsLocalRefresh(noOriginOrReferer), false);

  const noFetchMetadata = new Request("http://localhost:3000/api/advisory/model-availability/refresh-capabilities", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "x-panely-local-update": "1",
    },
  });
  assert.equal(allowsLocalRefresh(noFetchMetadata), false);

  const crossSite = new Request("http://localhost:3000/api/advisory/model-availability/refresh-capabilities", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "https://example.com",
      "sec-fetch-site": "cross-site",
      "x-panely-local-update": "1",
    },
  });
  assert.equal(allowsLocalRefresh(crossSite), false);

  const nonLoopback = new Request("http://example.test:3000/api/advisory/model-availability/refresh-capabilities", {
    method: "POST",
    headers: {
      host: "example.test:3000",
      origin: "http://example.test:3000",
      "sec-fetch-site": "same-origin",
      "x-panely-local-update": "1",
    },
  });
  assert.equal(allowsLocalRefresh(nonLoopback), false);

  const sameOrigin = new Request("http://localhost:3000/api/advisory/model-availability/refresh-capabilities", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
      "x-panely-local-update": "1",
    },
  });
  assert.equal(allowsLocalRefresh(sameOrigin), true);
});
