#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "verify-workflow: must be run inside a git repository" >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

python3 - <<'PY'
import ast
from pathlib import Path
ast.parse(Path("scripts/render_plan").read_text(), filename="scripts/render_plan")
PY
bash -n .githooks/pre-commit
bash -n workflow/bin/review.sh
grep -q -- '--output-last-message "$outfile"' workflow/bin/review.sh
grep -q -- '< /dev/null > "$log"' workflow/bin/review.sh
grep -q -- '--output-last-message .review/verifier.md' workflow/bin/review.sh
grep -q -- '< /dev/null > .review/verifier.md.log' workflow/bin/review.sh
grep -q -- 'scripts/render_plan --check "$plan"' .githooks/pre-commit

shopt -s nullglob
plans=(docs/plans/*.md)
if [[ ${#plans[@]} -eq 0 ]]; then
  echo "verify-workflow: no plan markdown files found under docs/plans" >&2
  exit 1
fi
validated_plans=0
for plan in "${plans[@]}"; do
  [[ "$(basename "$plan")" == "plan.template.md" ]] && continue
  scripts/render_plan --check "$plan" >/dev/null
  validated_plans=$((validated_plans + 1))
done
if [[ "$validated_plans" -eq 0 ]]; then
  echo "verify-workflow: no real plan markdown files found under docs/plans" >&2
  exit 1
fi

if [[ -f .github/workflows/release.yml ]]; then
  grep -q 'DISPATCH_TAG: ${{ inputs.tag }}' .github/workflows/release.yml
  grep -q 'git checkout --detach "refs/tags/${TAG}"' .github/workflows/release.yml
  grep -q 'git rev-list -n 1 "refs/tags/${TAG}"' .github/workflows/release.yml
  grep -q 'git merge-base --is-ancestor "${TAG_COMMIT}" origin/main' .github/workflows/release.yml
  python3 - <<'PY'
from pathlib import Path
import sys

in_run = False
run_indent = 0
for lineno, line in enumerate(Path(".github/workflows/release.yml").read_text().splitlines(), 1):
    stripped = line.lstrip()
    indent = len(line) - len(stripped)
    if stripped.startswith("run:"):
        if "${{" in line:
            print(f"verify-workflow: GitHub expression inside release run block at line {lineno}", file=sys.stderr)
            raise SystemExit(1)
        in_run = True
        run_indent = indent
        if not (stripped.startswith("run: |") or stripped.startswith("run: >")):
            in_run = False
        continue
    if in_run and stripped and indent <= run_indent:
        in_run = False
    if in_run and "${{" in line:
        print(f"verify-workflow: GitHub expression inside release run block at line {lineno}", file=sys.stderr)
        raise SystemExit(1)
PY
fi

python3 - <<'PY'
from pathlib import Path
import re

plan_style = re.search(r"<style>\n(.*?)\n</style>", Path("docs/plans/plan.example.html").read_text(), re.S).group(1)
tracker_style = re.search(r"<style>\n(.*?)\n</style>", Path("docs/plans/tracker.example.html").read_text(), re.S).group(1)
for plan in sorted(Path("docs/plans").glob("*.md")):
    if plan.name == "plan.template.md":
        continue
    html_path = plan.with_suffix(".html")
    tracker_path = plan.with_suffix(".tracker.html")
    html_style = re.search(r"<style>\n(.*?)\n</style>", html_path.read_text(), re.S).group(1)
    tracker_html_style = re.search(r"<style>\n(.*?)\n</style>", tracker_path.read_text(), re.S).group(1)
    if html_style != plan_style:
        raise SystemExit(f"style mismatch: {html_path}")
    if tracker_html_style != tracker_style:
        raise SystemExit(f"style mismatch: {tracker_path}")

demo_html = Path("docs/plans/demo.html").read_text()
demo_tracker = Path("docs/plans/demo.tracker.html").read_text()
assertions = {
    "plan progress": (demo_html, '<div class="count"><b>1</b> / 4 tasks · <b style="font-size:22px">25%</b></div>'),
    "tracker percent": (demo_tracker, ">25%</text>"),
    "tracker done tile": (demo_tracker, '<div class="stat done"><span class="n">1</span><span class="k">done</span></div>'),
    "tracker wip tile": (demo_tracker, '<div class="stat wip"><span class="n">1</span><span class="k">in progress</span></div>'),
    "tracker blocked tile": (demo_tracker, '<div class="stat block"><span class="n">1</span><span class="k">blocked</span></div>'),
    "tracker todo tile": (demo_tracker, '<div class="stat todo"><span class="n">1</span><span class="k">to do</span></div>'),
    "blocked strip": (demo_tracker, "Blocked / failed · needs attention"),
}
for label, (haystack, needle) in assertions.items():
    if needle not in haystack:
        raise SystemExit(f"missing semantic render assertion: {label}")
PY

index_dir="$(mktemp -d)"
tmp_index="$index_dir/tmp.index"
generated_index="$index_dir/generated.index"
tracker_generated_index="$index_dir/tracker-generated.index"
plan_index="$index_dir/plan.index"
changed_plan_index="$index_dir/changed-plan.index"
valid_plan_index="$index_dir/valid-plan.index"
working_review_index="$index_dir/working-review.index"
renderer_mode_index="$index_dir/renderer-mode.index"
approved_backup="$(mktemp)"
approved_symlink_target="$(mktemp)"
review_backup_dir="$(mktemp -d)"
demo_md_backup="$(mktemp)"
demo_html_backup="$(mktemp)"
demo_tracker_backup="$(mktemp)"
tmp_plan="$(mktemp docs/plans/workflow-verify-temp.XXXXXX.md)"
valid_plan="$(mktemp docs/plans/workflow-valid-plan.XXXXXX.md)"
untracked_review_file="$(mktemp workflow-untracked-review.XXXXXX.txt)"
svg_plan="$(mktemp docs/plans/workflow-svg-temp.XXXXXX.md)"
invalid_plan="$(mktemp docs/plans/workflow-invalid-plan.XXXXXX.md)"
invalid_marker_plan="$(mktemp docs/plans/workflow-invalid-marker.XXXXXX.md)"
invalid_section_plan="$(mktemp docs/plans/workflow-invalid-section.XXXXXX.md)"
bare_out="$(mktemp)"
skip_out="$(mktemp)"
reviewed_out="$(mktemp)"
generated_out="$(mktemp)"
tracker_generated_out="$(mktemp)"
plan_out="$(mktemp)"
valid_plan_out="$(mktemp)"
invalid_plan_out="$(mktemp)"
invalid_marker_out="$(mktemp)"
invalid_section_out="$(mktemp)"
delete_plan_out="$(mktemp)"
changed_plan_out="$(mktemp)"
generator_change_out="$(mktemp)"
missing_renderer_out="$(mktemp)"
renderer_mode_out="$(mktemp)"
scoped_review_out="$(mktemp)"
full_review_out="$(mktemp)"
failed_review_out="$(mktemp)"
contradictory_review_out="$(mktemp)"
untracked_review_out="$(mktemp)"
fake_codex_dir="$(mktemp -d)"
fake_dot_dir="$(mktemp -d)"
hook_repo="$(mktemp -d)"
release_repo="$(mktemp -d)"
release_resolve_script="$(mktemp)"
release_push_output="$(mktemp)"
release_dispatch_output="$(mktemp)"
release_invalid_output="$(mktemp)"
release_unreachable_output="$(mktemp)"
release_push_log="$(mktemp)"
release_dispatch_log="$(mktemp)"
had_approved=0
had_review_dir=0
demo_backups_ready=0
cleanup() {
  rm -rf "$index_dir"
  rm -f "$bare_out" "$skip_out" "$reviewed_out" "$generated_out" "$tracker_generated_out" "$plan_out" "$valid_plan_out" "$invalid_plan_out" "$invalid_marker_out" "$invalid_section_out" "$delete_plan_out" "$changed_plan_out" "$generator_change_out" "$missing_renderer_out" "$renderer_mode_out" "$scoped_review_out" "$full_review_out" "$failed_review_out" "$contradictory_review_out" "$untracked_review_out"
  rm -f "$tmp_plan" "$valid_plan" "${valid_plan%.md}.html" "${valid_plan%.md}.tracker.html" "$untracked_review_file" "$svg_plan" "${svg_plan%.md}.html" "${svg_plan%.md}.tracker.html" "$invalid_plan" "${invalid_plan%.md}.html" "${invalid_plan%.md}.tracker.html" "$invalid_marker_plan" "${invalid_marker_plan%.md}.html" "${invalid_marker_plan%.md}.tracker.html" "$invalid_section_plan" "${invalid_section_plan%.md}.html" "${invalid_section_plan%.md}.tracker.html"
  if [[ "$demo_backups_ready" == "1" ]]; then
    cp "$demo_md_backup" docs/plans/demo.md
    cp "$demo_html_backup" docs/plans/demo.html
    cp "$demo_tracker_backup" docs/plans/demo.tracker.html
  fi
  rm -f "$demo_md_backup" "$demo_html_backup" "$demo_tracker_backup"
  rm -rf "$fake_codex_dir"
  rm -rf "$fake_dot_dir"
  rm -rf "$hook_repo"
  rm -rf "$release_repo"
  rm -f "$release_resolve_script" "$release_push_output" "$release_dispatch_output" "$release_invalid_output" "$release_unreachable_output" "$release_push_log" "$release_dispatch_log"
  if [[ "$had_approved" == "1" ]]; then
    mkdir -p .review
    cp "$approved_backup" .review/approved.diff.sha256
  else
    rm -f .review/approved.diff.sha256
  fi
  if [[ "$had_review_dir" == "1" ]]; then
    rm -rf .review
    mkdir -p .review
    cp -R "$review_backup_dir/." .review/
  else
    rm -rf .review
  fi
  rm -f "$approved_backup" "$approved_symlink_target"
  rm -rf "$review_backup_dir"
}
trap cleanup EXIT

cat > "$invalid_plan" <<'MD'
# Plan: Invalid

**Status:** Draft · **rev 1** · _2026-06-25_
**Owner:** Codex
**Global validation gate:** `npm run verify`

## 1. Goal & success criteria
- **Problem:** Missing milestone structure.
MD
if scripts/render_plan "$invalid_plan" >"$invalid_plan_out" 2>&1; then
  cat "$invalid_plan_out"
  echo "verify-workflow: structurally empty plan unexpectedly rendered" >&2
  exit 1
fi

python3 - "$invalid_marker_plan" <<'PY'
from pathlib import Path
import sys

source = Path("docs/plans/demo.md").read_text(encoding="utf-8")
source = source.replace("- [wip] <task>", "- [wp] <task>", 1)
Path(sys.argv[1]).write_text(source, encoding="utf-8")
PY
if scripts/render_plan "$invalid_marker_plan" >"$invalid_marker_out" 2>&1; then
  cat "$invalid_marker_out"
  echo "verify-workflow: plan with unknown task marker unexpectedly rendered" >&2
  exit 1
fi

cat > "$invalid_section_plan" <<'MD'
# Plan: Invalid Section

**Status:** Draft · **rev 1** · _2026-06-25_
**Owner:** Codex
**Global validation gate:** `npm run verify`

## 6. Risks & open questions

### M1 — Wrong place  ·  → release `v0.1.0`  ·  depends on: none
**Outcome:** should fail

#### Phase 1.1 — Wrong place
- [ ] task
- **Testing Strategy:** test
- **Validation gate:** `npm run verify`

**Review checkpoint:** review
MD
if scripts/render_plan "$invalid_section_plan" >"$invalid_section_out" 2>&1; then
  cat "$invalid_section_out"
  echo "verify-workflow: milestone outside section 5 unexpectedly rendered" >&2
  exit 1
fi

GIT_INDEX_FILE="$tmp_index" git read-tree HEAD
GIT_INDEX_FILE="$generated_index" git read-tree HEAD
GIT_INDEX_FILE="$tracker_generated_index" git read-tree HEAD
GIT_INDEX_FILE="$plan_index" git read-tree HEAD
GIT_INDEX_FILE="$changed_plan_index" git read-tree HEAD
GIT_INDEX_FILE="$valid_plan_index" git read-tree HEAD
GIT_INDEX_FILE="$working_review_index" git read-tree HEAD
GIT_INDEX_FILE="$renderer_mode_index" git read-tree HEAD
renderer_blob="$(git hash-object -w scripts/render_plan)"
for seeded_index in "$plan_index" "$changed_plan_index" "$valid_plan_index"; do
  GIT_INDEX_FILE="$seeded_index" git update-index --add --cacheinfo 100755 "$renderer_blob" scripts/render_plan
done
cp docs/plans/demo.md "$demo_md_backup"
cp docs/plans/demo.html "$demo_html_backup"
cp docs/plans/demo.tracker.html "$demo_tracker_backup"
demo_backups_ready=1
if [[ -f .review/approved.diff.sha256 ]]; then
  cp .review/approved.diff.sha256 "$approved_backup"
  had_approved=1
fi
if [[ -d .review ]]; then
  cp -R .review/. "$review_backup_dir/"
  had_review_dir=1
fi

if [[ -f .github/workflows/release.yml ]]; then
  python3 - <<'PY' > "$release_resolve_script"
from pathlib import Path
import sys

lines = Path(".github/workflows/release.yml").read_text(encoding="utf-8").splitlines()
for index, line in enumerate(lines):
    if line.strip() != "- name: Resolve release tag":
        continue
    for run_index in range(index + 1, len(lines)):
        stripped = lines[run_index].lstrip()
        run_indent = len(lines[run_index]) - len(stripped)
        if stripped.startswith("- name:") and run_index > index + 1:
            break
        if stripped != "run: |":
            continue
        block_indent = run_indent + 2
        block = []
        for block_line in lines[run_index + 1:]:
            if block_line.strip():
                indent = len(block_line) - len(block_line.lstrip())
                if indent <= run_indent:
                    break
                block.append(block_line[block_indent:])
            else:
                block.append("")
        print("\n".join(block))
        sys.exit(0)
raise SystemExit("Resolve release tag run block not found")
PY
  (
    cd "$release_repo"
    git init -q
    git config user.email "workflow-verifier@example.invalid"
    git config user.name "Workflow Verifier"
    printf 'release verifier\n' > README.md
    git add README.md
    git commit -q -m base
    git branch -M main
    git tag -a v0.1.0 -m "v0.1.0"
    git remote add origin "$release_repo"
    tag_commit="$(git rev-list -n 1 refs/tags/v0.1.0)"

    GITHUB_REF_NAME="v0.1.0" GITHUB_EVENT_NAME="push" DISPATCH_TAG="" GITHUB_OUTPUT="$release_push_output" bash "$release_resolve_script" >"$release_push_log" 2>&1
    grep -qx "tag=v0.1.0" "$release_push_output"
    grep -qx "tag_commit=${tag_commit}" "$release_push_output"

    GITHUB_REF_NAME="main" GITHUB_EVENT_NAME="workflow_dispatch" DISPATCH_TAG="v0.1.0" GITHUB_OUTPUT="$release_dispatch_output" bash "$release_resolve_script" >"$release_dispatch_log" 2>&1
    grep -qx "tag=v0.1.0" "$release_dispatch_output"
    grep -qx "tag_commit=${tag_commit}" "$release_dispatch_output"

    if GITHUB_REF_NAME="main" GITHUB_EVENT_NAME="workflow_dispatch" DISPATCH_TAG="not-semver" GITHUB_OUTPUT="$release_invalid_output" bash "$release_resolve_script" >"$release_invalid_output" 2>&1; then
      cat "$release_invalid_output"
      echo "verify-workflow: release tag resolver accepted an invalid dispatch tag" >&2
      exit 1
    fi
    git checkout -q main
    git checkout --orphan release-verifier-side >/dev/null 2>&1
    git rm -rf -q .
    printf 'unreachable release verifier\n' > SIDE.md
    git add SIDE.md
    git commit -q -m side
    git tag -a v0.2.0 -m "v0.2.0"
    if GITHUB_REF_NAME="v0.2.0" GITHUB_EVENT_NAME="push" DISPATCH_TAG="" GITHUB_OUTPUT="$release_unreachable_output" bash "$release_resolve_script" >"$release_unreachable_output" 2>&1; then
      cat "$release_unreachable_output"
      echo "verify-workflow: release tag resolver accepted a tag outside origin/main" >&2
      exit 1
    fi
  )
fi

agent_blob="$(git rev-parse HEAD:package.json)"
GIT_INDEX_FILE="$tmp_index" git update-index --add --cacheinfo 100644 "$agent_blob" AGENTS.md

if GIT_INDEX_FILE="$tmp_index" .githooks/pre-commit >"$bare_out" 2>&1; then
  cat "$bare_out"
  echo "verify-workflow: bare hook unexpectedly passed" >&2
  exit 1
fi

generated_blob="$(git rev-parse HEAD:package.json)"
GIT_INDEX_FILE="$generated_index" git update-index --add --cacheinfo 100644 "$generated_blob" docs/plans/demo.html
if GIT_INDEX_FILE="$generated_index" SKIP_REVIEW=1 .githooks/pre-commit >"$generated_out" 2>&1; then
  cat "$generated_out"
  echo "verify-workflow: generated-only plan HTML unexpectedly passed" >&2
  exit 1
fi
GIT_INDEX_FILE="$tracker_generated_index" git update-index --add --cacheinfo 100644 "$generated_blob" docs/plans/demo.tracker.html
if GIT_INDEX_FILE="$tracker_generated_index" SKIP_REVIEW=1 .githooks/pre-commit >"$tracker_generated_out" 2>&1; then
  cat "$tracker_generated_out"
  echo "verify-workflow: generated-only tracker HTML unexpectedly passed" >&2
  exit 1
fi

GIT_INDEX_FILE="$renderer_mode_index" git update-index --add --cacheinfo 100644 "$renderer_blob" scripts/render_plan
GIT_INDEX_FILE="$renderer_mode_index" git add docs/plans/demo.md
if GIT_INDEX_FILE="$renderer_mode_index" SKIP_REVIEW=1 .githooks/pre-commit >"$renderer_mode_out" 2>&1; then
  cat "$renderer_mode_out"
  echo "verify-workflow: plan-related commit passed with non-executable staged renderer" >&2
  exit 1
fi

cp docs/plans/demo.md "$tmp_plan"
GIT_INDEX_FILE="$plan_index" git add "$tmp_plan"
if GIT_INDEX_FILE="$plan_index" SKIP_REVIEW=1 .githooks/pre-commit >"$plan_out" 2>&1; then
  cat "$plan_out"
  echo "verify-workflow: staged plan without generated views unexpectedly passed" >&2
  exit 1
fi
rm -f "$tmp_plan"
if GIT_INDEX_FILE="$plan_index" SKIP_REVIEW=1 .githooks/pre-commit >"$plan_out" 2>&1; then
  cat "$plan_out"
  echo "verify-workflow: staged plan missing from working tree unexpectedly passed" >&2
  exit 1
fi

cp docs/plans/demo.md "$valid_plan"
scripts/render_plan "$valid_plan" >/dev/null
GIT_INDEX_FILE="$valid_plan_index" git add "$valid_plan" "${valid_plan%.md}.html" "${valid_plan%.md}.tracker.html"
GIT_INDEX_FILE="$valid_plan_index" SKIP_REVIEW=1 .githooks/pre-commit >"$valid_plan_out" 2>&1

python3 - <<'PY'
from pathlib import Path

path = Path("docs/plans/demo.md")
source = path.read_text(encoding="utf-8")
path.write_text(source.replace("- [ ] <task>", "- [ ] <task>\n- [ ] Verifier staged source coverage", 1), encoding="utf-8")
PY
scripts/render_plan docs/plans/demo.md >/dev/null
GIT_INDEX_FILE="$changed_plan_index" git add docs/plans/demo.md
if GIT_INDEX_FILE="$changed_plan_index" SKIP_REVIEW=1 .githooks/pre-commit >"$changed_plan_out" 2>&1; then
  cat "$changed_plan_out"
  echo "verify-workflow: staged changed plan source without generated views unexpectedly passed" >&2
  exit 1
fi
cp "$demo_md_backup" docs/plans/demo.md
cp "$demo_html_backup" docs/plans/demo.html
cp "$demo_tracker_backup" docs/plans/demo.tracker.html

python3 - "$svg_plan" <<'PY'
from pathlib import Path
import re
import sys

source = Path("docs/plans/demo.md").read_text(encoding="utf-8")
source = re.sub(r"```mermaid\n.*?\n```", "```dot\ndigraph G { A -> B }\n```", source, count=1, flags=re.S)
source += "\n## 9. Non-task checklist\n- [ ] This checklist item must not count as a milestone task.\n"
Path(sys.argv[1]).write_text(source, encoding="utf-8")
PY
cat > "$fake_dot_dir/dot" <<'SH'
#!/usr/bin/env bash
cat >/dev/null
cat <<'SVG'
<?xml version="1.0"?>
<!DOCTYPE svg>
<svg xmlns="http://www.w3.org/2000/svg" ONLOAD=bad()>
  <script>alert("bad")</script>
  <foreignObject><div>bad</div></foreignObject>
  <a href=javascript:bad()><text OnClick=bad()>A to B</text></a>
</svg>
SVG
SH
chmod +x "$fake_dot_dir/dot"
PATH="$fake_dot_dir:$PATH" RENDER_PLAN_DIAGRAMS=svg scripts/render_plan "$svg_plan" >/dev/null
svg_html="$(<"${svg_plan%.md}.html")"
svg_html_lower="$(printf '%s' "$svg_html" | tr '[:upper:]' '[:lower:]')"
if [[ "$svg_html_lower" != *"<svg"* || "$svg_html_lower" == *"<script"* || "$svg_html_lower" == *"foreignobject"* || "$svg_html_lower" == *"onload="* || "$svg_html_lower" == *"onclick="* || "$svg_html_lower" == *"href="* ]]; then
  echo "verify-workflow: SVG diagram sanitization failed" >&2
  exit 1
fi
if [[ "$svg_html" != *'<div class="count"><b>1</b> / 4 tasks'* ]]; then
  echo "verify-workflow: checklist outside milestones changed rendered task counts" >&2
  exit 1
fi

mkdir -p "$hook_repo/.githooks" "$hook_repo/scripts" "$hook_repo/docs/plans"
cp .githooks/pre-commit "$hook_repo/.githooks/pre-commit"
cp scripts/render_plan "$hook_repo/scripts/render_plan"
cp docs/plans/demo.md "$hook_repo/docs/plans/demo.md"
cp docs/plans/demo.html "$hook_repo/docs/plans/demo.html"
cp docs/plans/demo.tracker.html "$hook_repo/docs/plans/demo.tracker.html"
cp docs/plans/plan.example.html "$hook_repo/docs/plans/plan.example.html"
cp docs/plans/tracker.example.html "$hook_repo/docs/plans/tracker.example.html"
chmod +x "$hook_repo/.githooks/pre-commit" "$hook_repo/scripts/render_plan"
(
  cd "$hook_repo"
  git init -q
  git config user.email "workflow-verifier@example.invalid"
  git config user.name "Workflow Verifier"
  git add .
  git commit -q -m base
  git rm --cached --quiet docs/plans/demo.md
  if SKIP_REVIEW=1 .githooks/pre-commit >"$delete_plan_out" 2>&1; then
    cat "$delete_plan_out"
    echo "verify-workflow: staged plan deletion without generated deletions unexpectedly passed" >&2
    exit 1
  fi
  git reset --hard -q HEAD
  python3 - <<'PY'
from pathlib import Path

path = Path("docs/plans/plan.example.html")
text = path.read_text(encoding="utf-8")
path.write_text(text.replace("\n</style>", "\n.verifier-stale-check{display:none}\n</style>", 1), encoding="utf-8")
PY
  git add docs/plans/plan.example.html
  if SKIP_REVIEW=1 .githooks/pre-commit >"$generator_change_out" 2>&1; then
    cat "$generator_change_out"
    echo "verify-workflow: renderer/template change with stale generated views unexpectedly passed" >&2
    exit 1
  fi
  git reset --hard -q HEAD
  chmod -x scripts/render_plan
  printf '\n' >> docs/plans/demo.md
  git add docs/plans/demo.md
  if SKIP_REVIEW=1 .githooks/pre-commit >"$missing_renderer_out" 2>&1; then
    cat "$missing_renderer_out"
    echo "verify-workflow: plan-related commit passed without executable renderer" >&2
    exit 1
  fi
)

GIT_INDEX_FILE="$tmp_index" SKIP_REVIEW=1 .githooks/pre-commit >"$skip_out" 2>&1

actual="$(GIT_INDEX_FILE="$tmp_index" git diff --cached --binary | shasum -a 256 | awk '{print $1}')"
mkdir -p .review
echo "$actual  git diff --cached --binary" > "$approved_symlink_target"
rm -f .review/approved.diff.sha256
ln -s "$approved_symlink_target" .review/approved.diff.sha256
if GIT_INDEX_FILE="$tmp_index" REVIEWED=1 .githooks/pre-commit >"$reviewed_out" 2>&1; then
  cat "$reviewed_out"
  echo "verify-workflow: symlinked review fingerprint unexpectedly passed" >&2
  exit 1
fi
rm -f .review/approved.diff.sha256
echo "0000000000000000000000000000000000000000000000000000000000000000  git diff --cached --binary" > .review/approved.diff.sha256
if GIT_INDEX_FILE="$tmp_index" REVIEWED=1 .githooks/pre-commit >"$reviewed_out" 2>&1; then
  cat "$reviewed_out"
  echo "verify-workflow: mismatched review fingerprint unexpectedly passed" >&2
  exit 1
fi
echo "$actual  git diff --cached --binary" > .review/approved.diff.sha256
GIT_INDEX_FILE="$tmp_index" REVIEWED=1 .githooks/pre-commit >"$reviewed_out" 2>&1

cat > "$fake_codex_dir/codex" <<'SH'
#!/usr/bin/env bash
out=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--output-last-message" ]]; then
    out="$2"
    shift 2
    continue
  fi
  shift
done
if [[ -z "$out" ]]; then
  exit 1
fi
if [[ "$out" == *"verifier.md" ]]; then
  printf '1. NO BLOCKING FINDINGS\n2. Advisory findings\n\n- Non-blocking follow-up.\n\nAPPROVED: yes\n' > "$out"
else
  printf 'NO FINDINGS\n' > "$out"
fi
SH
chmod +x "$fake_codex_dir/codex"
GIT_INDEX_FILE="$tmp_index" PATH="$fake_codex_dir:$PATH" CODEX_REVIEW_REASONING=low workflow/bin/review.sh >"$full_review_out" 2>&1
if [[ "$(awk '{print $1}' .review/approved.diff.sha256)" != "$actual" ]]; then
  cat "$full_review_out"
  echo "verify-workflow: unscoped staged review did not write the expected approval fingerprint" >&2
  exit 1
fi

sentinel="ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff  git diff --cached --binary"
echo "$sentinel" > .review/approved.diff.sha256
GIT_INDEX_FILE="$tmp_index" PATH="$fake_codex_dir:$PATH" CODEX_REVIEW_REASONING=low workflow/bin/review.sh AGENTS.md >"$scoped_review_out" 2>&1
if [[ "$(cat .review/approved.diff.sha256)" != "$sentinel" ]]; then
  cat "$scoped_review_out"
  echo "verify-workflow: scoped staged review replaced or removed full-diff approval" >&2
  exit 1
fi

printf 'untracked review coverage\n' > "$untracked_review_file"
echo "$sentinel" > .review/approved.diff.sha256
GIT_INDEX_FILE="$working_review_index" PATH="$fake_codex_dir:$PATH" CODEX_REVIEW_REASONING=low workflow/bin/review.sh "$untracked_review_file" >"$untracked_review_out" 2>&1
if [[ "$(cat .review/approved.diff.sha256)" != "$sentinel" ]]; then
  cat "$untracked_review_out"
  echo "verify-workflow: working-tree review replaced or removed full-diff approval" >&2
  exit 1
fi
if ! grep -q "approved working-tree diff" "$untracked_review_out"; then
  cat "$untracked_review_out"
  echo "verify-workflow: working-tree review did not exercise the untracked diff path" >&2
  exit 1
fi

cat > "$fake_codex_dir/codex" <<'SH'
#!/usr/bin/env bash
out=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--output-last-message" ]]; then
    out="$2"
    shift 2
    continue
  fi
  shift
done
if [[ -z "$out" ]]; then
  exit 1
fi
if [[ "$out" == *"verifier.md" ]]; then
  printf '1. NO BLOCKING FINDINGS\n2. NO ADVISORY FINDINGS\nAPPROVED: yes\n' > "$out"
  exit 0
fi
printf 'NO FINDINGS\n' > "$out"
exit 42
SH
chmod +x "$fake_codex_dir/codex"
if GIT_INDEX_FILE="$tmp_index" PATH="$fake_codex_dir:$PATH" CODEX_REVIEW_REASONING=low workflow/bin/review.sh >"$failed_review_out" 2>&1; then
  cat "$failed_review_out"
  echo "verify-workflow: review approved despite failed finder subprocesses" >&2
  exit 1
fi

cat > "$fake_codex_dir/codex" <<'SH'
#!/usr/bin/env bash
out=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--output-last-message" ]]; then
    out="$2"
    shift 2
    continue
  fi
  shift
done
if [[ -z "$out" ]]; then
  exit 1
fi
if [[ "$out" == *"verifier.md" ]]; then
  printf '1. NO BLOCKING FINDINGS\n\n2. Blocking findings\n\n- This should block approval.\n\nAPPROVED: yes\n' > "$out"
else
  printf 'NO FINDINGS\n' > "$out"
fi
SH
chmod +x "$fake_codex_dir/codex"
if GIT_INDEX_FILE="$tmp_index" PATH="$fake_codex_dir:$PATH" CODEX_REVIEW_REASONING=low workflow/bin/review.sh >"$contradictory_review_out" 2>&1; then
  cat "$contradictory_review_out"
  echo "verify-workflow: review approved contradictory verifier output" >&2
  exit 1
fi

echo "workflow verification passed"
