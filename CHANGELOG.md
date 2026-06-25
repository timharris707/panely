# Changelog

All notable Panely milestone changes will be documented in this file.

Panely follows sparse milestone releases. GitHub Releases are created from semver tags, and `v1.0.0` is reserved for an explicit production-ready decision.

## [Unreleased]

- Keep upcoming milestone changes here until the release PR renames this section to `## [vX.Y.Z] - YYYY-MM-DD - Milestone name`.

## [v0.5.0] - 2026-06-25 - Formal Board and Local CLI Trust

- Added Formal Board Review with independent first round, rebuttal, convergence, source-packet hashing, resume support, structured verdict artifacts, Markdown/HTML handoffs, and run metadata.
- Added local-only model settings for Claude, Codex, Gemini, and Antigravity with daily capability snapshots, explicit provider/source provenance, CLI update actions, and publish-safety visibility.
- Added evidence-based thinking controls so unsupported effort levels are hidden or normalized before execution; Claude `xhigh` now normalizes to `max`.
- Changed visible context-window labels to use provider-agnostic capability source states: verified, configured, or not reported.
- Fixed Homebrew-installed Gemini version checks so Panely compares Gemini against Homebrew’s current formula instead of npm’s latest package.
- Fixed dismissing an active session so it stays on Live and selects the next live session or empty live state instead of jumping to History.
- Added CI-backed GitHub Release workflow for semver tags, changelog extraction, built-in verdict validation, and the top-level release notes process.
- Verification: lint, unit tests, production build, typecheck, and publish-safety scanner run before release.
