export type AdvisoryIntent = "decision" | "stress-test" | "compare" | "ideas" | "red-team" | "debug";
export type AdvisoryPlannedMode = "roundtable" | "competitive" | "formal-board";

export function inferAdvisoryIntent(text: string): AdvisoryIntent {
  const lower = text.toLowerCase();
  if (/(stack trace|traceback|exception|failing test|test failure|regression|bug|crash|broken|doesn'?t work|typescript error|type error|build failed|lint error|runtime error|debug|root cause)/.test(lower)) {
    return "debug";
  }
  if (/(red[- ]?team|attack this|tear (this|it) apart|adversarial|devil'?s advocate)/.test(lower)) return "red-team";
  if (/(compare|versus| vs |alternative|option|which of these|trade[- ]?off)/.test(lower)) return "compare";
  if (/(brainstorm|generate ideas|come up with|new ideas|pitch|ideat)/.test(lower)) return "ideas";
  if (/(review|critique|audit|stress[- ]?test|pressure[- ]?test|evaluate|solid|gaps?|risks?|weakness|improve|fix|revise|changes? needed)/.test(lower)) return "stress-test";
  return "decision";
}

export function inferAdvisoryMode(intent: AdvisoryIntent, topic: string): AdvisoryPlannedMode {
  const lower = topic.toLowerCase();
  if (intent === "ideas") return "competitive";
  if (intent === "debug") {
    return /(quick|exploratory|brainstorm|talk through)/.test(lower) ? "roundtable" : "formal-board";
  }
  if (/(formal board|formal review|high[- ]?stakes|gate|ship\/caution\/block|verdict\.json|independent review|architecture gate|quality gate)/.test(lower)) {
    return "formal-board";
  }
  if ((intent === "stress-test" || intent === "red-team") && /(plan|spec|proposal|architecture|skill|repo|code|release|launch|migration|strategy)/.test(lower)) {
    return "formal-board";
  }
  return "roundtable";
}
