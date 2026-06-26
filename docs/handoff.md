# Handoff

**Updated:** 2026-06-26

## START HERE

Review the advisory UI/artifact branch state, confirm GitHub push/PR status, then decide whether the next build objective is tool-enabled code execution for board agents or another UI polish batch.

## STATE

The branch now contains the durable workflow install plus a substantial advisory UI/product batch. `npm run verify` passes. `core.hooksPath` is set to `.githooks`. `docs/plans/demo.md` is only a renderer/tracker example, not the active product plan.

## DONE

- Removed the obsolete Multica global instruction from `/Users/timharris/.codex/AGENTS.md`.
- Added global durable workflow instructions and prompt files.
- Added global templates, `workflow-init.sh`, `review.sh`, and `render_plan`.
- Ran the initializer in Panely.
- Generated `docs/plans/demo.html` and `docs/plans/demo.tracker.html` from `docs/plans/demo.md`.
- Verified generated plan and tracker CSS matches the visual contract byte-for-byte.
- Verified the pre-commit hook blocks bare commits and accepts `SKIP_REVIEW=1` or matching `REVIEWED=1` using a temporary git index.
- Added the New Session wizard updates: Workspace folder picker, restored mode selection, formal board three-round controls with conditional Round 3 execution, consent gating feedback, Generate Advisor Plan in the footer, and removal of context budget/output perspectives.
- Added a read-only Workspace source snapshot action that uses `/api/advisory/project-context` so board agents can receive selected local repo files in the source packet again.
- Replaced scattered artifact export buttons with one Artifacts panel containing Full Artifact, Decision Memo, Action Plan, Risk Memo, and Board Brief, each with PDF/HTML/MD downloads.
- Cleaned artifact formatting to match the Full Artifact style: restrained black document headings, repaired legacy bold-label damage, removed leaked duplicate formal headings, and preserved the full transcript artifact.
- Updated model capability handling and Model Connections refresh support for local CLI thinking-level metadata.
- Loosened `workflow/bin/review.sh` so verifier-approved advisory findings no longer block reviewed commits; only confirmed blockers should stop publishing.

## NEXT

- Push the current branch to GitHub.
- Decide whether to build a second, explicit "tool-enabled coding mode" where selected agents can run commands or write code in isolated worktrees. The current Workspace source snapshot is read-only context, not live tool access.

## KEY FILES

- `AGENTS.md` — project operating manual for the workflow.
- `WORKFLOW.md` — short day-to-day usage guide.
- `docs/goal.md` — durable current objective.
- `docs/handoff.md` — cold-start resume state.
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
