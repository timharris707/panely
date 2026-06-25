# Panely

**A local-first AI advisory room for serious decisions.**

Panely turns an important question, plan, document, or product decision into a structured working session with a panel of AI advisors.

Instead of giving you one flat chatbot response, Panely lets multiple frontier models examine the same brief from different roles, challenge each other over multiple rounds, and produce an artifact you can actually use: a decision memo, critique, vote breakdown, transcript, or next-step plan.

The goal is simple: make high-quality strategic thinking feel like a live advisory board, not another chat thread.

## What You Can Do With It

- Drop in a strategy, proposal, Markdown plan, HTML document, product question, or technical design.
- Let the AI propose the right advisor lineup for the problem.
- Run a roundtable when you want collaborative judgment.
- Run a competitive session when you want sharper disagreement, pitches, critiques, and votes.
- Choose specific models, providers, thinking levels, response lengths, pacing, and context budgets.
- Watch the discussion unfold live through local model CLIs.
- Export the final artifact, vote results, Markdown transcript, and printable PDF view.

## Why Panely Exists

Most AI tools collapse complex decisions into a single assistant voice. That is useful for quick answers, but weak for judgment-heavy work where disagreement matters.

Panely is built around a different pattern:

- Multiple advisors review the same brief.
- Each advisor has a specific role, model, and reasoning level.
- The session can unfold over rounds so the panel can challenge itself.
- Competitive mode forces agents to pitch, critique, and vote.
- The final output is an artifact you can save, share, or turn into work.

It is especially useful for reviewing plans, pressure-testing product strategy, comparing options, auditing a proposal, or turning a messy question into a clear next move.

## How It Works

1. **Describe the decision**
   Start with the topic, question, or document you want reviewed. Panely can infer the intent from the brief instead of forcing you through a rigid form.

2. **Approve the advisory plan**
   Panely proposes the advisor roles, model/provider choices, thinking levels, number of rounds, response length, pacing, and context budget.

3. **Run the room**
   Advisors respond through local subscription-backed CLIs such as Claude Code, Codex, and Gemini CLI. Roundtable mode emphasizes synthesis. Competitive mode emphasizes ideas, critique, and voting.

4. **Leave with an artifact**
   The session produces useful output beyond the conversation itself: recommendations, dissent, risks, votes, action items, transcripts, and exportable decision records.

## What Makes It Different

**Local-first by design**

Panely is intended to run on your machine, using local files and local model CLIs where possible. It is not built around a cloud database dependency or a hosted black box.

**Built for frontier model subscriptions**

The app is designed to route work through local subscription-backed tools such as Claude Code, Codex, and Gemini CLI. You can see which provider and model each advisor is using.

**Two useful session modes**

Roundtable mode is for collaborative judgment. Competitive mode is for forcing sharper ideas: each advisor pitches one proposal, critiques the others, and votes.

**AI-generated advisor plans**

Instead of asking users to manually pick a cast of static agents, Panely can infer the right perspectives from the topic or attached source material, propose the panel, and let the user approve or adjust it.

**Serious source review**

Panely supports large source packets and adjustable context budgets up to 1M characters, making it suitable for reviewing Markdown plans, HTML documents, specs, and compact repo packets.

**Artifacts, not just chat**

Sessions can produce exportable Markdown, printable PDF views, vote breakdowns, final synthesis artifacts, and full transcript records.

## Who It Is For

Panely is built for people who make judgment-heavy decisions and want more than a single assistant response:

- Founders refining product direction
- Operators reviewing plans before execution
- Engineers pressure-testing architecture
- Investors comparing opportunities
- Writers and strategists evaluating positioning
- Builders who want multiple frontier models to disagree constructively

## Example Uses

- Review a launch plan before execution.
- Debate whether a product should stay local-first or move cloud-first.
- Compare several go-to-market strategies.
- Pressure-test a technical architecture.
- Ask multiple frontier models to evaluate a proposal independently.
- Turn an advisory session into a decision record with dissent, risks, and next actions.

## Current Status

Panely is an active local-first prototype. It is already useful for real advisory sessions, but the product is still evolving quickly.

Current capabilities include:

- Local session storage
- Roundtable sessions
- Competitive pitch / critique / vote sessions
- AI-planned advisor lineups
- Per-agent model and thinking-level selection
- Local CLI model routing
- Adjustable source context budgets
- Markdown export
- Printable HTML / PDF artifact view
- Full session transcript export
- Model settings page

Planned improvements include stronger end-of-run artifacts, richer provenance, better replay, and more deliberate follow-up loops for decisions that need to be revisited.

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

## Publishing

For this project, **deploy** means publishing the latest source to GitHub:

```bash
git status
npm run lint
npm run build
git add .
git commit -m "Describe the change"
git push origin main
```

Panely is local-first and does not require Vercel or any hosted deployment target. A hosted demo can be added later if needed, but the normal release path is GitHub plus local execution.

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
- `docs/source-material/`

Before publishing or sharing a fork, run a secret scan and review any local data directories.

## Product Direction

The next major product direction is stronger end-of-run artifacts: decision records, standing decisions, provenance metadata, and follow-up loops that make a session useful after the debate ends.

Panely should not just answer a question. It should help you make, defend, revisit, and improve important decisions.
