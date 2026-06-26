# Project Workflow

This project uses the durable Codex workflow installed from `~/.codex/workflow`.

## Project Defaults

- Durable goal: `docs/goal.md`
- Memory index: `memory/MEMORY.md`
- Canonical handoff: `docs/handoff.md`
- Plans: `docs/plans/*.md`
- Generated plan views: `docs/plans/<plan>.html` and `docs/plans/<plan>.tracker.html`
- Editable CSS visual contracts: `docs/plans/plan.example.html` and `docs/plans/tracker.example.html`
- Global validation gate: `npm run verify`
- Release tag scope: `single-package tags: vMAJOR.MINOR.PATCH`

## Start Every Substantial Session

1. Read `docs/goal.md`.
2. Read `memory/MEMORY.md` and any relevant facts.
3. Read `docs/handoff.md`.
4. Read the active plan under `docs/plans/` if one is referenced by the goal or handoff.
5. Confirm the next concrete step before making code changes.

## Working Loop

For non-trivial work:

1. Keep the goal current.
2. Update the plan markdown before implementation when scope changes.
3. Run `scripts/render_plan docs/plans/<feature>.md` after plan edits.
4. Implement milestone-by-milestone.
5. Run the phase gate and the global validation gate before marking tasks `[x]`.
6. Run adversarial review before committing.
7. Commit with `REVIEWED=1 git commit ...` after a clean review, or `SKIP_REVIEW=1 git commit ...` for trivial changes only.
8. Update `docs/handoff.md` before ending the session.

## Review Gate

Use `workflow/bin/review.sh` for adversarial review. It writes `.review/approved.diff.sha256` for the exact staged diff. The pre-commit hook blocks `REVIEWED=1` commits if the staged diff changed after review.

Git hook configuration is local clone state. If this repo is freshly cloned or `core.hooksPath` is unset, run `/workflow-init` or `git config core.hooksPath .githooks` before relying on commit-time enforcement.

## Generated Artifacts

Never hand-edit generated plan views. Edit the markdown source and re-run `scripts/render_plan`. The `plan.example.html` and `tracker.example.html` files are editable CSS visual contracts for the renderer, not generated plan views; only their `<style>` blocks are consumed.

## Modularization Rule

When a core file reaches roughly 1,000-2,000 lines and more features are queued, split it into focused modules before adding the next feature. Keep a thin facade and keep tests green.
