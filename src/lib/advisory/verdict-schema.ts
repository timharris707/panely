import type { FormalBoardVerdict } from "../../types/advisory.ts";

const SCHEMA = "advisory-board/verdict@1";
const VERDICTS = new Set(["ship", "caution", "block"]);
const CONFIDENCE = new Set(["low", "medium", "high"]);

export interface VerdictSchemaValidation {
  ok: boolean;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finalRoundVerdict(seat: Record<string, unknown>) {
  const verdicts = seat.round_verdicts;
  return Array.isArray(verdicts) ? verdicts.at(-1) : undefined;
}

export function validateFormalBoardVerdict(value: unknown): VerdictSchemaValidation {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: ["verdict must be a JSON object"] };
  }

  for (const field of ["schema", "verdict", "confidence", "board", "rounds"]) {
    if (!(field in value)) errors.push(`missing required field: ${field}`);
  }

  if (value.schema !== SCHEMA) errors.push(`schema must be ${SCHEMA}`);
  if (typeof value.verdict !== "string" || !VERDICTS.has(value.verdict)) {
    errors.push("verdict must be one of ship, caution, block");
  }
  if (typeof value.confidence !== "string" || !CONFIDENCE.has(value.confidence)) {
    errors.push("confidence must be one of low, medium, high");
  }
  if (!Number.isInteger(value.rounds) || (value.rounds as number) < 1) {
    errors.push("rounds must be a positive integer");
  }

  if (!Array.isArray(value.board)) {
    errors.push("board must be an array");
  } else {
    for (const [index, seat] of value.board.entries()) {
      const where = `board[${index}]`;
      if (!isRecord(seat)) {
        errors.push(`${where} must be an object`);
        continue;
      }
      if (typeof seat.seat !== "string" || !seat.seat.trim()) errors.push(`${where}.seat is required`);
      if (typeof seat.model !== "string" || !seat.model.trim()) errors.push(`${where}.model is required`);
      if ("lens" in seat && seat.lens !== undefined && typeof seat.lens !== "string") errors.push(`${where}.lens must be a string`);
      if ("dropped" in seat && typeof seat.dropped !== "boolean") errors.push(`${where}.dropped must be boolean`);
      if (!Array.isArray(seat.round_verdicts) || seat.round_verdicts.length === 0) {
        errors.push(`${where}.round_verdicts must be a non-empty array`);
      } else {
        for (const verdict of seat.round_verdicts) {
          if (typeof verdict !== "string" || !VERDICTS.has(verdict)) {
            errors.push(`${where}.round_verdicts contains invalid verdict ${JSON.stringify(verdict)}`);
          }
        }
      }
    }

    const ran = value.board.filter((seat) => isRecord(seat) && seat.dropped !== true);
    if (ran.length < 2) errors.push(`a board needs at least two seats that ran; found ${ran.length}`);

    if ("unanimous" in value && typeof value.unanimous !== "boolean") {
      errors.push("unanimous must be boolean when present");
    } else if (typeof value.unanimous === "boolean" && typeof value.verdict === "string" && ran.length >= 2) {
      const finals = new Set(ran.map(finalRoundVerdict).filter(Boolean));
      const actuallyUnanimous = finals.size === 1 && finals.has(value.verdict);
      if (value.unanimous !== actuallyUnanimous) {
        errors.push(`unanimous=${value.unanimous} does not match final-round verdicts`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function formalVerdictPassesBuiltInGate(verdict: FormalBoardVerdict) {
  const validation = validateFormalBoardVerdict(verdict);
  return {
    ok: verdict.valid && validation.ok,
    errors: validation.errors,
  };
}
