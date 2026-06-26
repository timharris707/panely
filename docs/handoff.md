# Handoff

**Updated:** 2026-06-26

## START HERE

Review the GitHub marketing-page update on branch `codex/durable-workflow-kit`, confirm the PR status, then decide whether to merge the README improvements or continue with deeper product/landing-page work.

## STATE

The branch contains the durable workflow install, the advisory UI/artifact batch, and a new README marketing pass for the public GitHub page. `npm run verify` passes after the README changes and stale landing-copy removal. `core.hooksPath` is set to `.githooks`. `docs/plans/demo.md` is only a renderer/tracker example, not the active product plan.

## DONE

- Refreshed the local `advisory-board` skill from `timharris707/skills` commit `bd975bb` before using it; the prior local copy is backed up as `advisory-board.backup.20260626091802`.
- Set the runtime `/goal` and durable `docs/goal.md` to the Panely GitHub marketing audit.
- Ran three independent sub-agent audit seats:
  - General-public positioning: found the README led with architecture/model language before human decision outcomes.
  - Mode/model clarity: found the three modes were named but too compressed and easy to confuse with Claude/Codex/Gemini model choices.
  - Artifact strength: scored current artifact examples `3/10` because the README named artifacts without showing their shape.
- Rewrote the top README story around tough decisions across life, work, product, creative, investment, and technical situations.
- Added a plain-language `Session Modes` table for Roundtable, Competitive, and Formal Board Review, explicitly separating modes from model/provider choices.
- Added `What You Get After A Session` with the current artifact library: Full Artifact, Decision Memo, Action Plan, Risk Memo, and Board Brief, including an illustrative non-coding example.
- Updated `CHANGELOG.md` `[Unreleased]` with the README marketing and artifact-copy improvements.
- Removed obsolete `content/landing-page-copy.md` because it described an abandoned hosted-SaaS direction with unsupported pricing, free-session, testimonial, share-link, latest-model, and SOC 2 claims.
- Ran `npm run verify` successfully after the README changes and stale landing-copy removal.

## NEXT

- Review the pushed PR for merge readiness.
- Decide whether to build a deeper public landing page, screenshots, or demo artifacts after the GitHub README update is merged.

## KEY FILES

- `AGENTS.md` — project operating manual for the workflow.
- `WORKFLOW.md` — short day-to-day usage guide.
- `docs/goal.md` — durable current objective.
- `docs/handoff.md` — cold-start resume state.
- `README.md` — public GitHub page and main marketing surface.
- `CHANGELOG.md` — milestone change log.
- `docs/plans/demo.md` — demo source plan.
- `scripts/render_plan` — markdown to plan/tracker renderer.
- `.githooks/pre-commit` — review and generated-artifact commit gate.
- `workflow/bin/review.sh` — adversarial review fan-out runner.
- `src/components/advisory/LaunchWizard.tsx` — New Session wizard, Workspace, source snapshot, mode/consent controls.
- `src/components/advisory/ArtifactsPanel.tsx` — artifact library, preview, and PDF/HTML/MD download logic.
- `src/lib/advisory/project-context.ts` — bounded local repo source packet scanner.
- `src/lib/advisory/decision-record.ts` — full artifact and formal verdict cleanup.

## GOTCHAS / DON'T-REPEAT

- `codex exec` must be run with stdin redirected from `/dev/null` inside `review.sh`; otherwise nested review passes wait for inherited stdin.
- Use `--output-last-message` for nested `codex exec` review passes so verifier input contains findings, not full Codex transcripts.
- The review verifier now separates blocking findings from advisory follow-ups. Do not re-tighten it to require zero confirmed findings unless intentionally changing the workflow policy.
- Existing Panely docs under `docs/` were already untracked before this workflow install; do not assume every untracked doc was created by this task.
- Do not confuse Workspace source snapshots with tool-enabled agents. Snapshot mode gives advisors bounded read-only context; it does not let them run shell commands or edit the repo.
- The removed landing-page copy is not current product truth. Avoid claims about pricing, free sessions, testimonials, hosted share links, SOC 2 readiness, or model-provider guarantees unless they are reverified and implemented.
- Formal Board Review is prompt-level independent first-pass review, not full filesystem/network/process isolation.
