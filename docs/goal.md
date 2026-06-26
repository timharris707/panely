# Goal

**Status:** active
**Created:** 2026-06-25
**Updated:** 2026-06-26
**Repo:** `/Users/timharris/projects/panely`
**Validation gate:** `npm run verify`
**Active plan:** none
**Handoff:** docs/handoff.md

## Objective

Publish the durable Codex workflow install and advisory UI/artifact batch for Panely, then set the next real build goal.

## Success Criteria

- Global workflow kit exists under `/Users/timharris/.codex/workflow`.
- Panely has project workflow files, a durable goal, memory index, handoff, plan/tracker renderer, review gate, and pre-commit hook.
- The demo plan renders both `docs/plans/demo.html` and `docs/plans/demo.tracker.html` as an example, but it is not the active product plan.
- The pre-commit hook blocks bare commits and accepts reviewed or explicitly skipped commits.
- The release workflow avoids direct GitHub expression interpolation inside shell logic.
- The advisory UI batch includes workspace source snapshots, model capability refresh support, artifact downloads, and formal-board artifact cleanup.

## Current Next Step

- Push the current workflow/advisory branch to GitHub, then replace this goal with the next real build objective.

## Notes

- Keep this file current when the objective changes.
- Runtime `/goal` state is helpful, but this file is the durable project source.
