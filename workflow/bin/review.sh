#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "review: must be run inside a git repository" >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"
mkdir -p .review
review_reasoning="${CODEX_REVIEW_REASONING:-high}"

pathspec=("$@")
if [[ $# -gt 0 ]]; then
  for arg in "$@"; do
    if [[ "$arg" == *$'\n'* || "$arg" == *$'\r'* ]]; then
      echo "review: pathspecs must not contain newlines" >&2
      exit 2
    fi
  done
fi
if [[ ${#pathspec[@]} -gt 0 ]]; then
  printf -v scope "%q " "${pathspec[@]}"
  scope="${scope% }"
else
  scope="current staged diff"
fi
staged_diff="$(mktemp .review/staged.diff.XXXXXX)"
working_diff="$(mktemp .review/working.diff.XXXXXX)"
if [[ ${#pathspec[@]} -gt 0 ]]; then
  git diff --cached --binary -- "${pathspec[@]}" > "$staged_diff"
  git diff --binary -- "${pathspec[@]}" > "$working_diff"
else
  git diff --cached --binary > "$staged_diff"
  git diff --binary > "$working_diff"
fi
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  if [[ -f "$file" ]]; then
    {
      echo
      echo "diff --git a/$file b/$file"
      git diff --no-index -- /dev/null "$file" || true
    } >> "$working_diff"
  fi
done < <(
  if [[ ${#pathspec[@]} -gt 0 ]]; then
    git ls-files --others --exclude-standard -- "${pathspec[@]}"
  else
    git ls-files --others --exclude-standard
  fi
)

if [[ -s "$staged_diff" ]]; then
  diff_mode="staged"
  diff_file="$staged_diff"
  fingerprint="$(shasum -a 256 "$staged_diff" | awk '{print $1}')"
else
  diff_mode="working-tree"
  diff_file="$working_diff"
  fingerprint=""
fi

if [[ ! -s "$diff_file" ]]; then
  echo "review: no staged or working-tree diff to review"
  exit 0
fi

rm -f .review/finder-*.md .review/finder-*.failed .review/finder-bundle.md .review/verifier.md .review/verifier.md.log
if [[ ${#pathspec[@]} -eq 0 ]]; then
  rm -f .review/approved.diff.sha256
fi

lenses=(
  "correctness and behavior preservation"
  "security and input handling"
  "edge cases and error paths"
  "public API and state surface"
  "test blind spots"
  "docs and comment drift"
)

run_finder() {
  local idx="$1"
  local lens="$2"
  local outfile=".review/finder-${idx}.md"
  local prompt
  prompt="$(cat <<PROMPT
You are an independent adversarial code review finder.

Repository: $repo_root
Scope: $scope
Diff mode: $diff_mode
Lens: $lens

Use only read-only inspection. Do not edit files.

Review the diff in $diff_file and relevant surrounding code. Report only concrete findings that include:
- severity
- file:line
- how to trigger or reproduce
- why this matters

If no concrete findings survive your lens, write "NO FINDINGS".
PROMPT
)"
  if command -v codex >/dev/null 2>&1; then
    local log="$outfile.log"
    rm -f "$outfile" "$log"
    codex exec --color never -c "model_reasoning_effort=\"$review_reasoning\"" --sandbox read-only --cd "$repo_root" --ephemeral --output-last-message "$outfile" "$prompt" < /dev/null > "$log" 2>&1 || {
      {
        echo "Finder failed for lens: $lens"
        echo
        cat "$log"
      } > "$outfile.tmp"
      mv "$outfile.tmp" "$outfile"
      touch ".review/finder-${idx}.failed"
    }
    if [[ ! -s "$outfile" ]]; then
      cp "$log" "$outfile"
    fi
  else
    echo "codex CLI not found; unable to run finder for lens: $lens" > "$outfile"
  fi
}

idx=0
for lens in "${lenses[@]}"; do
  idx=$((idx + 1))
  run_finder "$idx" "$lens" &
done
wait

finder_failed=0
for marker in .review/finder-*.failed; do
  [[ -e "$marker" ]] || continue
  finder_failed=1
done

bundle=".review/finder-bundle.md"
{
  echo "# Finder Reports"
  echo
  for file in .review/finder-[0-9]*.md; do
    echo "## ${file}"
    cat "$file"
    echo
  done
} > "$bundle"

if [[ "$finder_failed" == "1" ]]; then
  cat "$bundle"
  echo "review: one or more finder runs failed; approval was not recorded" >&2
  exit 1
fi

verifier_prompt="$(cat <<PROMPT
You are the skeptic verifier for an adversarial review.

Repository: $repo_root
Scope: $scope
Diff mode: $diff_mode

Read the finder reports in $bundle. Verify each claimed finding against the repository and diff. Try to refute each one. Confirm only findings that are concrete, reproducible, and grounded in file/line evidence.

Classify surviving findings as blocking or advisory:
- Blocking findings are likely correctness, security, data-loss, privacy, migration, or release-breaker regressions introduced by this diff that should stop a commit.
- Advisory findings are real but non-blocking follow-ups, including low/medium polish, UX rough edges with an obvious workaround, test gaps, pre-existing issues, portability gaps outside the current release target, or concerns that can reasonably ship with documentation.
- Do not block solely because more improvements are possible.

Output:
1. Blocking findings, or "NO BLOCKING FINDINGS".
2. Advisory findings, or "NO ADVISORY FINDINGS".
3. Rejected finder claims with a short reason.
4. End with exactly one line:
APPROVED: yes
or
APPROVED: no

Use APPROVED: yes when there are no blocking findings, even if advisory findings remain.
PROMPT
)"

if command -v codex >/dev/null 2>&1; then
  rm -f .review/verifier.md .review/verifier.md.log
  verifier_status=0
  codex exec --color never -c "model_reasoning_effort=\"$review_reasoning\"" --sandbox read-only --cd "$repo_root" --ephemeral --output-last-message .review/verifier.md "$verifier_prompt" < /dev/null > .review/verifier.md.log 2>&1 || verifier_status=$?
  if [[ ! -s .review/verifier.md ]]; then
    cp .review/verifier.md.log .review/verifier.md
  fi
  if [[ "$verifier_status" -ne 0 ]]; then
    cat .review/verifier.md
    echo "review: verifier run failed; approval was not recorded" >&2
    exit 1
  fi
else
  {
    echo "codex CLI not found; skeptic verification could not run."
    echo "APPROVED: no"
  } > .review/verifier.md
fi

cat .review/verifier.md

approval_yes_count="$(grep -cx "APPROVED: yes" .review/verifier.md || true)"
approval_no_count="$(grep -cx "APPROVED: no" .review/verifier.md || true)"
last_verifier_line="$(tail -n 1 .review/verifier.md)"
top_verifier_lines="$(awk 'NF { print; n += 1; if (n == 5) exit }' .review/verifier.md)"
no_blocking_top_count="$(printf '%s\n' "$top_verifier_lines" | grep -Eic "NO[[:space:]]+BLOCKING[[:space:]]+FINDINGS\\.?" || true)"
late_blocking_heading_count="$(tail -n +2 .review/verifier.md | grep -Eic "^[[:space:]]*([0-9]+[.)][[:space:]]*)?(\\*\\*)?Blocking findings(\\*\\*)?:?\\b" || true)"

if [[ "$approval_yes_count" == "1" && "$approval_no_count" == "0" && "$last_verifier_line" == "APPROVED: yes" && "$no_blocking_top_count" -ge 1 && "$late_blocking_heading_count" == "0" ]]; then
  if [[ "$diff_mode" == "staged" && ${#pathspec[@]} -eq 0 ]]; then
    echo "$fingerprint  git diff --cached --binary" > .review/approved.diff.sha256
    echo "review: approved staged diff fingerprint $fingerprint"
  elif [[ "$diff_mode" == "staged" ]]; then
    echo "review: approved scoped staged diff, but no commit fingerprint was written because the hook verifies the full staged diff"
  else
    echo "review: approved working-tree diff, but no commit fingerprint was written because nothing is staged"
  fi
  exit 0
fi

echo "review: not approved; fix confirmed findings or inspect .review/verifier.md" >&2
exit 1
