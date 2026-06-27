# Panely

**An AI advisory board for decisions too important for one opinion.**

Panely helps you think through decisions you keep circling: changing jobs, moving cities, making a major purchase, weighing a family tradeoff, shaping a product, comparing investment ideas, or deciding whether a creative bet is worth taking.

Write the situation once, choose the kind of session you need, and a panel of AI advisors debates the options, pressure-tests the risks, and leaves you with a clear memo, dissenting views, votes when useful, and next steps.

The goal is simple: make hard decisions feel less like a lonely chat thread and more like a serious advisory board.

> **There's also an open, run-it-yourself version.** [Advisory Board](https://github.com/timharris707/skills) is a sibling project — the same idea (a board of frontier models on one decision), built as a provider-agnostic agent skill you can run yourself through Claude Code, Codex, or whatever your preferred harness is. Same maker.

## What You Can Do With It

- Bring a messy decision, proposal, personal tradeoff, business plan, source file, or local project snapshot.
- Let Panely propose the right advisor roles for the problem.
- Run a Roundtable when you want thoughtful advice and synthesis.
- Run a Competitive session when you want rival options, critiques, and votes.
- Run a Formal Board Review when you need independent first-pass review, rebuttal, and a structured `ship` / `caution` / `block` verdict.
- Save the result as a decision memo, action plan, risk memo, board brief, full transcript, Markdown export, HTML view, or printable PDF.

## Why Panely Exists

Most AI tools collapse complex decisions into a single assistant voice. That is useful for quick answers, but weak for judgment-heavy work where disagreement matters.

Panely is built around a different pattern:

- Multiple advisors review the same brief.
- Each advisor has a specific role and perspective.
- The session can unfold over rounds so the panel can challenge itself.
- Competitive mode forces advisors to pitch, critique, and vote.
- Formal Board Review keeps peer output out of the first review pass, then produces an explicit evidence, judgment, and could-not-verify split.
- The final output is an artifact you can save, share, or turn into work.

It is useful for personal, professional, and technical decisions: choosing between jobs, deciding whether to relocate, evaluating a major purchase, preparing for a professional conversation, pressure-testing a product strategy, auditing a proposal, or turning a messy question into a clear next move.

Panely is not a substitute for medical, legal, financial, or other professional advice. It is a structured way to surface options, risks, dissent, and next steps before you decide.

## Session Modes

Panely has three session modes. A mode is the shape of the meeting, not the AI model. You can choose the mode first, then choose which local AI tools or providers power each advisor.

| Mode | Use It When | What Happens | What You Get |
| --- | --- | --- | --- |
| **Roundtable** | You want thoughtful advice and synthesis. | Advisors discuss the same question, build on each other's points, and surface agreement and disagreement. | A clear recommendation, key risks, dissenting views, and next steps. |
| **Competitive** | You want stronger ideas or a decision between options. | Each advisor pitches an approach, critiques the others, then votes. | A winning idea or ranked set of ideas, plus the reasoning behind the vote. |
| **Formal Board Review** | You need stricter review of an important plan, proposal, or document. | Advisors first review the source independently, then see peer output, rebut, and converge on a structured verdict. | A `ship`, `caution`, or `block` verdict with evidence, judgment calls, open questions, and dissent. |

The short version: use **Roundtable** for advice, **Competitive** for choosing between ideas, and **Formal Board Review** when you want a more disciplined review artifact.

Models are separate from modes. Panely can route advisors through local tools such as Claude Code, Codex, and Gemini CLI when they are installed and authenticated, but the session mode is about how the discussion is run.

## What You Get After A Session

Panely ends each completed session with an artifact library, not just a chat log. You can preview and download each artifact as Markdown, HTML, or printable PDF.

Example session: "Should I take a remote job and move closer to family?"

- **Board Brief:** Executive-ready summary with the recommended call, strongest arguments, dissent, key risks, action items, and model provenance.
- **Decision Memo:** Decision, recommendation, options considered, dissent and caveats, risks, open questions, action items, and provenance.
- **Action Plan:** Ordered next steps, owner slots, dependencies, watchpoints, risks to track, and follow-up checks.
- **Risk Memo:** Primary failure modes, weak assumptions, could-not-verify items, mitigations, and unresolved questions.
- **Full Artifact + Transcript:** The complete decision record plus the round-by-round advisor transcript, vote results when applicable, and provider/model details.

Illustrative excerpt:

> **Recommendation:** Continue negotiating unless the new role confirms remote permanence, relocation timing, and total compensation in writing.
>
> **Dissent:** One advisor argues the family-support upside outweighs the career uncertainty, but only if there is a six-month fallback plan.
>
> **Next actions:** Price the move, request written remote-policy terms, compare health and retirement benefits, and schedule a follow-up review before accepting.

## How It Works

1. **Describe the decision**
   Start with the topic, question, or document you want reviewed. Panely can infer the intent from the brief instead of forcing you through a rigid form.

2. **Approve the advisory plan**
   Panely proposes advisor roles, session mode, model/provider choices, number of rounds, response length, pacing, and source scope.

3. **Run the room**
   Advisors respond through configured local model tools. Roundtable mode emphasizes synthesis. Competitive mode emphasizes ideas, critique, and voting. Formal Board Review emphasizes prompt-level independent review and a structured verdict.

4. **Leave with an artifact**
   The session produces useful output beyond the conversation itself: recommendations, dissent, risks, votes, action items, transcripts, and exportable decision records.

## What Makes It Different

**Local-first by design**

Panely is intended to run on your machine, using local storage and local model CLIs where possible. It is not built around a cloud database dependency or a hosted black box.

Local-first does not mean every model call stays on your machine: selected local CLIs may send prompts and source material to their model providers. Panely surfaces provider disclosure so you can decide what to share.

**Built for frontier model subscriptions**

The app is designed to route work through local subscription-backed tools such as Claude Code, Codex, and Gemini CLI. You can see which provider and model each advisor is using, and Panely hides unavailable local models from setup.

**AI-generated advisor plans**

Instead of asking users to manually pick a cast of static agents, Panely can infer the right perspectives from the topic or attached source material, propose the panel, and let the user approve or adjust it.

**Serious source review**

Panely supports large source packets, file attachments, and read-only local workspace source snapshots, making it suitable for reviewing Markdown plans, HTML documents, specs, and compact repo packets.

**Artifacts, not just chat**

Sessions can produce Full Artifact, Decision Memo, Action Plan, Risk Memo, Board Brief, vote breakdowns, exportable Markdown, printable PDF views, HTML views, and full transcript records.

## Who It Is For

Panely is built for people who make judgment-heavy decisions and want more than a single assistant response:

- People weighing career, relocation, family, purchase, or creative decisions
- Founders refining product direction
- Operators reviewing plans before execution
- Engineers pressure-testing architecture
- Investors comparing opportunities
- Writers and strategists evaluating positioning
- Builders who want multiple frontier models to disagree constructively

## Example Uses

- Compare a job offer against staying in your current role.
- Decide whether to move, rent, buy, or delay a major life change.
- Weigh the tradeoffs in a family, budget, or time-allocation decision.
- Pressure-test a launch plan, go-to-market strategy, or technical architecture.
- Evaluate several creative, investment, or business ideas side by side.
- Prepare a better set of questions before talking with a lawyer, doctor, accountant, advisor, or mentor.
- Turn an advisory session into a decision record with dissent, risks, and next actions.

## Current Status

Panely is an active local-first prototype. It is already useful for real advisory sessions, but the product is still evolving quickly.

Current capabilities include:

- Local session storage
- Roundtable sessions
- Competitive pitch / critique / vote sessions
- Formal Board Review sessions with independent first-pass review, rebuttal, and structured verdicts
- AI-planned advisor lineups
- Per-advisor model selection and thinking-level controls where the selected CLI supports them
- Local CLI model routing for configured tools
- File attachments and read-only local workspace source snapshots
- Artifact library with Full Artifact, Decision Memo, Action Plan, Risk Memo, and Board Brief
- Markdown, HTML, printable PDF, and full transcript export
- Model settings page

Planned improvements include better replay, clearer follow-up loops, and more deliberate support for decisions that need to be revisited.

## Local Development

Install dependencies:

```bash
npm install
```

Run the app locally:

```bash
npm run dev
```

Open:

```text
http://localhost:3000/advisory
```

Build for production:

```bash
npm run build
```

## Verification

Before merging release-bound work, run:

```bash
npm run verify
```

This runs lint, tests, production build, typecheck, the publish-safety scanner, and workflow verification.

## Releases

For Panely, a GitHub Release is a milestone publication, not a per-deploy log. Releases are sparse, semver-tagged, and created by CI.

Release rules:

- Releases are created only when a semver tag like `v0.5.0` is pushed.
- Release tags should point to a merged, green `main` commit.
- Release notes come from the matching `CHANGELOG.md` section first.
- If the matching changelog section is missing, the workflow falls back to GitHub-generated notes.
- Pre-`v1.0.0`, minor versions track milestones, such as `v0.5.0` for M5.
- Patch versions are for fixes within a released milestone.
- `v1.0.0` is reserved for an explicit production-ready call.

Milestone release flow:

```bash
git checkout main
git pull --ff-only origin main
git tag -a v0.5.0 -m "Panely v0.5.0"
git push origin v0.5.0
```

The `.github/workflows/release.yml` workflow creates the GitHub Release from that tag.

Routine GitHub publish language:

- `commit + push` means the code is on `origin/main`.
- `release` means the code is also tagged with `vX.Y.Z` and has a GitHub Release with notes.
- When a Panely change is described as deployed or published for users, confirm that both the push and the release tag happened.

Curate `CHANGELOG.md` as part of the milestone PR:

```md
## [Unreleased]

## [v0.5.0] - 2026-06-25 - Formal Board Review

- Added ...
- Changed ...
- Verification: `npm run verify` passed.
```

After publishing, treat tags as immutable. The commands below are an emergency repair path only, not the normal way to create releases. If a release is botched and nobody depends on it yet, fix it by deleting the release and tag, then re-tagging the corrected commit:

```bash
gh release delete v0.5.0 --yes
git push origin --delete v0.5.0
git tag -d v0.5.0
git tag -a v0.5.0 -m "Panely v0.5.0"
git push origin v0.5.0
```

Panely is local-first and does not require Vercel or any hosted deployment target. A hosted demo can be added later if needed, but the normal release path is GitHub milestone releases plus local execution.

## Local Model Tools

Panely is designed to work best when these CLIs are installed and authenticated locally:

- `claude`
- `codex`
- `gemini`

The app detects available local tools and routes advisor calls through configured provider/model mappings.

## Security Notes

Panely is intended to keep project data local by default. Do not commit local `.env` files, SQLite databases, generated exports, or private source packets.

The repository ignores common local secret and data paths, including:

- `.env*`
- `.vercel/`
- `*.sqlite`
- `data/advisory/exports/`
- `data/advisory/packets/`
- `data/advisory/briefs/`
- `data/advisory/formal-runs/`
- `docs/source-material/`
- `docs/source-packets/`

Before publishing or sharing a fork, run:

```bash
node scripts/publish-safety-check.mjs
```

The scanner checks Git publish candidates for local advisory data, generated source packets, env files, key-like strings, and other content that should not land in the public repository.

## Product Direction

The next major product direction is stronger end-of-run artifacts: decision records, standing decisions, provenance metadata, and follow-up loops that make a session useful after the debate ends.

Panely should not just answer a question. It should help you make, defend, revisit, and improve important decisions.
