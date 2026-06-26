# Durable Codex Workflow

This repo uses a file-backed workflow so work survives context resets.

Start a session by reading:

1. `docs/goal.md`
2. `memory/MEMORY.md` plus relevant facts
3. `docs/handoff.md`
4. the active plan in `docs/plans/`

Use `/goal <objective>` to set the durable objective. Use `/plan <feature>` for substantial work. The plan markdown is canonical; `scripts/render_plan` generates the full plan HTML and the compact tracker HTML. If slash commands are loaded, `/track` is the prompt wrapper around the same render command.

During implementation, keep checklist markers current:

- `[ ]` todo
- `[wip]` in progress
- `[x]` done
- `[f]` blocked

Before marking a phase done, run its validation gate and the global gate. Before committing non-trivial work, stage the intended files and run `/review`; only a staged-diff review records the fingerprint required for `REVIEWED=1 git commit ...`. Use `SKIP_REVIEW=1` only for trivial changes.

At the end of a session, run `/handoff` or update `docs/handoff.md` with `START HERE`, `STATE`, `DONE`, `NEXT`, `KEY FILES`, and `GOTCHAS / DON'T-REPEAT`.

Git hooks are local clone configuration. After a fresh clone, run `/workflow-init` or `git config core.hooksPath .githooks`.
