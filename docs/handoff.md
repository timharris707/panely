# Handoff

**Updated:** 2026-06-25

## START HERE

Read `docs/goal.md`, confirm the workflow PR state, then set the next real build objective before creating an active product plan.

## STATE

The global workflow kit has been installed under `/Users/timharris/.codex/workflow`, slash-command prompts were added under `/Users/timharris/.codex/prompts`, and Panely has been initialized with project workflow files. `npm run verify` is the detected global validation gate. `core.hooksPath` is set to `.githooks`. `docs/plans/demo.md` is only a renderer/tracker example, not the active product plan.

## DONE

- Removed the obsolete Multica global instruction from `/Users/timharris/.codex/AGENTS.md`.
- Added global durable workflow instructions and prompt files.
- Added global templates, `workflow-init.sh`, `review.sh`, and `render_plan`.
- Ran the initializer in Panely.
- Generated `docs/plans/demo.html` and `docs/plans/demo.tracker.html` from `docs/plans/demo.md`.
- Verified generated plan and tracker CSS matches the visual contract byte-for-byte.
- Verified the pre-commit hook blocks bare commits and accepts `SKIP_REVIEW=1` or matching `REVIEWED=1` using a temporary git index.

## NEXT

- After this branch is pushed, set the next real build goal and create a real plan with `/goal <objective>` and `/plan <feature>`.

## KEY FILES

- `AGENTS.md` — project operating manual for the workflow.
- `WORKFLOW.md` — short day-to-day usage guide.
- `docs/goal.md` — durable current objective.
- `docs/handoff.md` — cold-start resume state.
- `docs/plans/demo.md` — demo source plan.
- `scripts/render_plan` — markdown to plan/tracker renderer.
- `.githooks/pre-commit` — review and generated-artifact commit gate.
- `workflow/bin/review.sh` — adversarial review fan-out runner.

## GOTCHAS / DON'T-REPEAT

- `codex exec` must be run with stdin redirected from `/dev/null` inside `review.sh`; otherwise nested review passes wait for inherited stdin.
- Use `--output-last-message` for nested `codex exec` review passes so verifier input contains findings, not full Codex transcripts.
- Existing Panely docs under `docs/` were already untracked before this workflow install; do not assume every untracked doc was created by this task.
