import { spawnSync } from "child_process";
import { NextResponse } from "next/server";
import { PROVIDERS } from "@/lib/ai/providers";

const TOOLS = ["claude", "codex", "gemini"] as const;

function detectTool(command: (typeof TOOLS)[number]) {
  const located = spawnSync("which", [command], {
    encoding: "utf8",
    timeout: 1000,
  });

  if (located.status !== 0) {
    return { available: false };
  }

  const version = spawnSync(command, ["--version"], {
    encoding: "utf8",
    timeout: 2000,
  });

  return {
    available: true,
    path: located.stdout.trim(),
    version: version.status === 0 ? version.stdout.trim() || version.stderr.trim() : undefined,
  };
}

export async function GET() {
  const tools = Object.fromEntries(TOOLS.map((tool) => [tool, detectTool(tool)]));
  const models = PROVIDERS.map((model) => ({
    id: model.id,
    name: model.name,
    provider: model.provider,
    model: model.model,
    localCli: model.localCli,
    source: model.localCli ? `Local ${model.localCli} CLI` : "Not configured",
    available: model.localCli ? Boolean(tools[model.localCli]?.available) : false,
    cliPath: model.localCli ? tools[model.localCli]?.path : undefined,
    cliVersion: model.localCli ? tools[model.localCli]?.version : undefined,
    intent: model.intent,
  }));
  return NextResponse.json({ tools, models, routing: "local-cli-only" });
}
