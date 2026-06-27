# Releasing

Milestone releases are changelog-first.

## Rules

- Use one release per product milestone.
- Do not release infra/docs/CI-only changes unless explicitly requested.
- Keep `CHANGELOG.md` with a `## [Unreleased]` section.
- Pre-1.0 minor versions track milestones; reserve `v1.0.0` for an explicit production-ready decision.
- Use patch releases for follow-up fixes.

## Tag Format

Panely is currently a single-package repo. Use `vMAJOR.MINOR.PATCH`.

Do not use scoped monorepo tags here unless the repo is intentionally converted to a monorepo and `.github/workflows/release.yml` is updated to match.

## Flow

1. Move the relevant `CHANGELOG.md` bullets from `[Unreleased]` into `## [vX.Y.Z] - YYYY-MM-DD - <milestone>`.
2. Add a fresh empty `## [Unreleased]` section.
3. Commit the changelog.
4. Merge or push the release commit to `main` so it is reachable from `origin/main`.
5. Tag that release commit.
6. Push the tag.
7. Let `.github/workflows/release.yml` create the GitHub Release from that changelog section.

Do not run `gh release create` by hand during the normal flow.

If the workflow cannot find the matching changelog section, it falls back to generated GitHub notes so a pushed tag still produces a release. Treat that as an exception to clean up, not the normal release path.
