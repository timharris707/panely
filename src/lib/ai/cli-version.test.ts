import test from "node:test";
import assert from "node:assert/strict";
import { compareSemverLike, extractSemver, isVersionOutdated } from "./cli-version.ts";

test("extractSemver finds versions inside CLI output", () => {
  assert.equal(extractSemver("codex-cli 0.135.0"), "0.135.0");
  assert.equal(extractSemver("2.1.177 (Claude Code)"), "2.1.177");
});

test("compareSemverLike compares installed and latest versions", () => {
  assert.equal(compareSemverLike("0.38.2", "0.47.0"), -1);
  assert.equal(compareSemverLike("2.1.191", "2.1.177"), 1);
  assert.equal(compareSemverLike("1.2.3", "1.2.3"), 0);
});

test("isVersionOutdated returns undefined when versions cannot be parsed", () => {
  assert.equal(isVersionOutdated("unknown", "0.47.0"), undefined);
  assert.equal(isVersionOutdated("0.38.2", "0.47.0"), true);
  assert.equal(isVersionOutdated("0.47.0", "0.47.0"), false);
});
