import type { FormalBoardState, FormalBoardVerdict } from "../../types/advisory.ts";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function listItems(values: string[]) {
  return values.length
    ? values.map((value) => `<li>${escapeHtml(value)}</li>`).join("\n")
    : "<li>None recorded.</li>";
}

function markdownList(values: string[]) {
  return values.length ? values.map((value) => `- ${value}`).join("\n") : "- None recorded.";
}

function markdownTableCell(value: string | undefined) {
  return (value || "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ")
    .trim() || "unknown";
}

export function formalVerdictArtifactName(verdict: FormalBoardVerdict) {
  return verdict.valid ? "verdict.json" : "panely-invalid-verdict.json";
}

export function renderFormalConsensusMarkdown(input: {
  title: string;
  topic: string;
  state: FormalBoardState;
  verdict: FormalBoardVerdict;
  clerkSynthesisMarkdown: string;
}) {
  const boardRows = input.verdict.board
    .slice()
    .sort((a, b) => a.seat.localeCompare(b.seat))
    .map((seat) =>
      `| ${markdownTableCell(seat.seat)} | ${markdownTableCell(seat.lens || "Formal reviewer")} | ${markdownTableCell(seat.model)} | ${seat.dropped ? "dropped/degraded" : "ran"} | ${seat.round_verdicts.map((item) => item.toUpperCase()).join(", ")} |`
    );
  const dropped = input.verdict.droppedSeats.map((seat) => `${seat.agentId}${seat.reason ? `: ${seat.reason}` : ""}`);
  const degraded = input.verdict.degradedSeats.map((seat) => `${seat.agentId}${seat.reason ? `: ${seat.reason}` : ""}`);

  return [
    `# Formal Board Review — ${input.title}`,
    "",
    `Topic: ${input.topic}`,
    `Date: ${input.verdict.date}`,
    `Source packet SHA-256: ${input.state.sourcePacketHash}`,
    `Protocol: ${input.state.protocol}`,
    "",
    "## Verdict",
    "",
    `- Verdict: ${input.verdict.verdict.toUpperCase()}`,
    `- Confidence: ${input.verdict.confidence}`,
    `- Valid: ${input.verdict.valid ? "yes" : "no"}`,
    `- Unanimous: ${input.verdict.unanimous ? "yes" : "no"}`,
    `- Rounds: ${input.verdict.rounds}`,
    `- Same-seat continuity: ${input.verdict.sameSeatContinuity.length ? input.verdict.sameSeatContinuity.join(", ") : "none"}`,
    ...(input.verdict.validityReason ? [`- Validity note: ${input.verdict.validityReason}`] : []),
    "",
    input.verdict.summary,
    "",
    "## Board",
    "",
    "| Seat | Lens | Model | Status | Round Verdicts |",
    "| ---- | ---- | ----- | ------ | -------------- |",
    ...(boardRows.length ? boardRows : ["| none | unknown | unknown | missing | none |"]),
    "",
    "## Evidence-backed",
    "",
    markdownList(input.verdict.evidenceBacked),
    "",
    "## Judgment calls",
    "",
    markdownList(input.verdict.judgmentCalls),
    "",
    "## Could not verify",
    "",
    markdownList(input.verdict.couldntVerify),
    "",
    "## Minority report",
    "",
    markdownList(input.verdict.minorityReport),
    "",
    "## Dropped or degraded seats",
    "",
    "### Dropped",
    markdownList(dropped),
    "",
    "### Degraded",
    markdownList(degraded),
    "",
    "## Open questions",
    "",
    markdownList(input.verdict.open_questions),
    "",
    "## Next actions",
    "",
    markdownList(input.verdict.next_actions),
    "",
    "## Isolation posture",
    "",
    `- Mode: ${input.state.isolation?.mode || "prompt-level"}`,
    `- Filesystem isolation: ${input.state.isolation?.filesystemIsolation ? "yes" : "no"}`,
    `- Network isolation: ${input.state.isolation?.networkIsolation ? "yes" : "no"}`,
    `- Source material scope: ${input.state.isolation?.sourceMaterialScope || "source-packet"}`,
    `- Note: ${input.state.isolation?.note || "Prompt-level peer-output isolation only."}`,
    "",
    "## Artifact manifest",
    "",
    `- Source packet: source-packet.md`,
    `- Verdict: ${formalVerdictArtifactName(input.verdict)}`,
    `- Run metadata: run-metadata.md`,
    `- Handoff data: handoff-data.json`,
    `- Final HTML: final-consensus.html`,
    `- Clerk synthesis: clerk-synthesis.md`,
    "",
    "## Clerk synthesis",
    "",
    input.clerkSynthesisMarkdown.trim() || "No clerk synthesis was produced.",
    "",
  ].join("\n");
}

export function buildFormalRunMetadata(input: {
  title: string;
  topic: string;
  state: FormalBoardState;
  verdict?: FormalBoardVerdict;
  sourcePacketHash: string;
  synthesisProducer?: string;
  synthesisModel?: string;
  synthesisNeutrality?: string;
}) {
  const roundsRun = input.verdict?.rounds ?? Math.max(1, ...input.state.rounds.map((artifact) => artifact.round));
  const isolation = input.state.isolation;
  const seats = input.state.seats.map((seat) => {
    const answered = seat.model || "unknown";
    const status = seat.status === "ran"
      ? "ran"
      : seat.status === "degraded"
      ? "degraded"
      : seat.status === "dropped"
      ? `dropped${seat.statusReason ? ` (${seat.statusReason})` : ""}`
      : "pending";
    return `| ${seat.agentId} | ${seat.role || "Formal reviewer"} | ${seat.model || "unknown"} | ${answered} | configured per seat | local CLI | ${status} |`;
  });

  return [
    `# Run Metadata — ${input.title}`,
    "",
    `Date: ${new Date().toISOString().slice(0, 10)}   ·   Rounds run: ${roundsRun}   ·   Cross-reading: summaries`,
    "Output: full handoff",
    "Lens preset: custom",
    "",
    "## Seats",
    "",
    "| Seat | Lens | Model requested | Model that answered | Reasoning/effort | Auth mode | Status |",
    "| ---- | ---- | --------------- | ------------------- | ---------------- | --------- | ------ |",
    ...seats,
    "",
    "## Source",
    "",
    "Access method: single source packet",
    `Source packet SHA-256: ${input.sourcePacketHash}`,
    "Sensitivity & handling: see session provider disclosure",
    "",
    "## Isolation",
    "",
    `Mode: ${isolation?.mode || "prompt-level"}`,
    `Source material scope: ${isolation?.sourceMaterialScope || "source-packet"}`,
    `Filesystem isolation: ${isolation?.filesystemIsolation ? "yes" : "no"}`,
    `Network isolation: ${isolation?.networkIsolation ? "yes" : "no"}`,
    `CWD mode by phase: ${JSON.stringify(isolation?.cwdModeByPhase || { "round-1": "app-working-directory", "round-2": "app-working-directory", synthesis: "app-working-directory" })}`,
    isolation?.note || "Round 1 uses prompt-level peer-output isolation over one source packet. Panely does not yet claim conductor-level filesystem or network isolation for Formal Board Review.",
    "",
    "## Synthesis",
    "",
    `Producer: ${input.synthesisProducer || "formal-board-clerk"}`,
    `Model that answered: ${input.synthesisModel || "unknown"}`,
    `Neutrality: ${input.synthesisNeutrality || "neutral-clerk"}`,
    "",
    "## Run",
    "",
    "| Stage | Started | Finished | Wall-clock | Tokens in/out (if known) |",
    "| ----- | ------- | -------- | ---------- | ------------------------ |",
    "| Round 1 | recorded in session run attempts | recorded in session run attempts | see session JSON | unknown |",
    "| Round 2 | recorded in session run attempts | recorded in session run attempts | see session JSON | unknown |",
    "| Synth | recorded in session run attempts | recorded in session run attempts | see session JSON | unknown |",
    "",
    "Preflight: selected model health was checked before session start.",
    "Commands: executed through Panely local CLI router; exact command details are represented in session run attempts and provenance.",
    `Notes: ${input.verdict?.validityReason || "No validity caveat recorded."}`,
    "",
  ].join("\n");
}

export function buildFormalHandoffData(input: {
  title: string;
  topic: string;
  state: FormalBoardState;
  verdict: FormalBoardVerdict;
  finalConsensusMarkdown: string;
}) {
  return {
    title: input.title,
    subtitle: escapeHtml(input.topic),
    date: input.verdict.date,
    board: input.verdict.board.map((seat) => `${escapeHtml(seat.seat)} (${escapeHtml(seat.lens || "reviewer")}, ${escapeHtml(seat.model)})`).join("<br>"),
    rounds: String(input.verdict.rounds),
    verdict: input.verdict.verdict.toUpperCase(),
    verdict_class: input.verdict.verdict,
    verdict_note: escapeHtml(input.verdict.summary),
    plan: paragraphHtml(input.finalConsensusMarkdown),
    metadata: escapeHtml(`source packet ${input.state.sourcePacketHash}; valid=${input.verdict.valid}`),
    dissent_flag: input.verdict.dissent.length ? "Dissent recorded" : "No explicit dissent recorded",
    seats: input.verdict.board.map((seat) => ({
      seat_name: seat.seat,
      seat_lens: seat.lens || "Formal reviewer",
      seat_model: seat.model,
      seat_status: seat.dropped ? "dropped" : "ran",
      seat_status_class: seat.dropped ? "dropped" : "ran",
      seat_highlight: seat.dropped ? "This seat did not complete the continuity gate for the final board." : "",
      rounds: seat.verdictsEstimated
        ? []
        : seat.round_verdicts.map((roundVerdict, index) => ({
            round_label: `Round ${index + 1}`,
            round_verdict: roundVerdict.toUpperCase(),
            round_verdict_class: roundVerdict,
            round_confidence: input.verdict.confidence,
            round_review: "",
          })),
    })),
    blockers: input.verdict.blockers.map((item) => ({ blocker_title: item.title, blocker_body: escapeHtml(item.body) })),
    dissents: input.verdict.dissent.map((item) => ({ dissent_who: item.who, dissent_body: escapeHtml(item.body) })),
    caveats: input.verdict.couldntVerify.map((item) => ({ caveat_claim: escapeHtml(item), caveat_impact: "Could affect confidence if contradicted." })),
    questions: input.verdict.open_questions.map((question) => ({ question: escapeHtml(question) })),
    actions: input.verdict.next_actions.map((action) => ({ action: escapeHtml(action) })),
  };
}

export function renderFormalConsensusHtml(input: {
  title: string;
  topic: string;
  state: FormalBoardState;
  verdict: FormalBoardVerdict;
  finalConsensusMarkdown: string;
}) {
  const data = buildFormalHandoffData(input);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.title)}</title>
<style>
body{margin:0;background:#f6f5f1;color:#1c1d22;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:860px;margin:0 auto;padding:36px 22px 72px}
header,.verdict,section{background:#fff;border:1px solid #e4e3dd;border-radius:14px;padding:22px;margin:0 0 18px}
h1{margin:0 0 8px;font-size:30px;line-height:1.2}h2{margin:0 0 12px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#74777f}
.muted{color:#4a4d57}.chip{display:inline-block;border:1px solid #d2d1c9;border-radius:999px;padding:4px 10px;margin:4px 6px 0 0;font-size:13px}
.verdict{border-left:7px solid #b9791b}.verdict.ship{border-left-color:#2f7d46;background:#e9f5ec}.verdict.block{border-left-color:#b23535;background:#fbe9e9}.verdict.caution{background:#fdf2dd}
.seat{border:1px solid #e4e3dd;border-radius:12px;padding:16px;margin:12px 0}.seat h3{margin:0 0 4px}
li{margin:6px 0}pre{white-space:pre-wrap;background:#faf9f5;border:1px solid #e4e3dd;border-radius:10px;padding:14px}
</style>
</head>
<body>
<main>
<header>
<p class="muted">Formal Board Review</p>
<h1>${escapeHtml(input.title)}</h1>
<p>${escapeHtml(input.topic)}</p>
<span class="chip">${escapeHtml(data.date)}</span><span class="chip">${escapeHtml(data.rounds)} rounds</span><span class="chip">source ${escapeHtml(input.state.sourcePacketHash.slice(0, 12))}</span>
</header>
<section class="verdict ${input.verdict.verdict}">
<h2>Verdict</h2>
<h1>${input.verdict.verdict.toUpperCase()} · ${input.verdict.confidence} confidence</h1>
<p>${escapeHtml(input.verdict.summary)}</p>
<p class="muted">Unanimous: ${input.verdict.unanimous ? "yes" : "no"} · Valid: ${input.verdict.valid ? "yes" : "no"}</p>
</section>
<section><h2>Board</h2>${input.verdict.board.map((seat) => `<div class="seat"><h3>${escapeHtml(seat.seat)}</h3><p class="muted">${escapeHtml(seat.lens || "Formal reviewer")} · ${escapeHtml(seat.model)} · ${seat.dropped ? "dropped/degraded" : "ran"}</p><p>Round verdicts: ${seat.verdictsEstimated ? "No completed round verdict recorded." : seat.round_verdicts.map((item) => item.toUpperCase()).join(", ")}</p></div>`).join("")}</section>
<section><h2>Evidence-backed</h2><ul>${listItems(input.verdict.evidenceBacked)}</ul></section>
<section><h2>Judgment Calls</h2><ul>${listItems(input.verdict.judgmentCalls)}</ul></section>
<section><h2>Could Not Verify</h2><ul>${listItems(input.verdict.couldntVerify)}</ul></section>
<section><h2>Minority Report</h2><ul>${listItems(input.verdict.minorityReport)}</ul></section>
<section><h2>Next Actions</h2><ul>${listItems(input.verdict.next_actions)}</ul></section>
<section><h2>Final Consensus Markdown</h2><pre>${escapeHtml(input.finalConsensusMarkdown)}</pre></section>
</main>
</body>
</html>`;
  if (/\{\{[^}]+\}\}/.test(html) || /<script\b|<link\b|\b(?:src|href)=["']https?:\/\//i.test(html)) {
    throw new Error("Rendered Formal Board HTML violates self-contained output contract.");
  }
  return html;
}
