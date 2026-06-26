# Goal

**Status:** active
**Created:** 2026-06-25
**Updated:** 2026-06-26
**Repo:** Panely checkout
**Validation gate:** `npm run verify`
**Active plan:** docs/plans/github-marketing.md
**Handoff:** docs/handoff.md

## Objective

Create, adversarially review, and then execute a durable plan to make Panely's GitHub presence as honest, marketable, and useful as possible for a broad public audience, including README polish, screenshots, sample artifacts, repo metadata, example prompts, trust/limitations copy, and a release-versioning audit toward a credible `v0.9.x` public-consumption candidate and eventual `v1.0.0`.

## Success Criteria

- A source-of-truth plan exists at `docs/plans/github-marketing.md`, with generated HTML and tracker views.
- The plan covers the remaining GitHub presentation work: screenshots/GIFs, sanitized sample artifacts, repo description/topics, a nontechnical first prompt, honest trust/limitations copy, and examples for broad life/work decisions.
- The plan includes a release-versioning audit that preserves existing tags, treats retrospective tags as opt-in governance exceptions, defines `v0.9.x` as a forward public-consumption candidate, and reserves `v1.0.0` for an explicit production-ready decision.
- The plan itself is adversarially reviewed before implementation starts.
- Every implementation milestone requires `npm run verify`, `git diff --check`, publish-safety, and adversarial review before merge.

## Current Next Step

- Commit and push the reviewed `docs/plans/github-marketing.md` plan and generated views, then execute M1.

## Notes

- Keep this file current when the objective changes.
- Runtime `/goal` state is helpful, but this file is the durable project source.
