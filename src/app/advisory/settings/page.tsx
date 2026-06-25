"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert, RefreshCw, ShieldCheck } from "lucide-react";
import "@/styles/advisory.css";

type ToolStatus = {
  available: boolean;
  path?: string;
  version?: string;
  latestVersion?: string;
  packageName?: string;
  updateCommand?: string;
  replacementFor?: string;
  authStatus?: "signed-in" | "auth-required" | "unknown";
  updateStatus?: "current" | "outdated" | "unknown" | "missing";
  isOutdated?: boolean;
  checkedAt?: string;
  nextCheckAt?: string;
  error?: string;
};

type LocalCliToolId = "claude" | "codex" | "gemini" | "agy";

type ToolUpdateResult = {
  tool: LocalCliToolId;
  ok: boolean;
  command: string;
  args: string[];
  stdout?: string;
  stderr?: string;
  error?: string;
  before?: ToolStatus;
  after?: ToolStatus;
};

type ModelStatus = {
  id: string;
  name: string;
  provider: string;
  model: string;
  localCli?: "claude" | "codex" | "gemini";
  source: string;
  available: boolean;
  cliPath?: string;
  cliVersion?: string;
  intent?: string;
  contextWindow?: number;
  thinkingLevels?: string[];
  intendedUse?: string;
  probe?: {
    ok: boolean;
    durationMs: number;
    status: string;
    checkedAt: string;
    nextCheckAt: string;
    cached?: boolean;
    error?: string;
  };
};

type AvailabilityResponse = {
  tools: Record<string, ToolStatus>;
  models: ModelStatus[];
  routing: string;
};

function formatContextWindow(contextWindow?: number) {
  if (!contextWindow) return "Context unknown";
  if (contextWindow >= 1000000) return `${(contextWindow / 1000000).toFixed(0)}M context`;
  if (contextWindow >= 1000) return `${Math.round(contextWindow / 1000)}K context`;
  return `${contextWindow} context`;
}

function formatCheckTime(value?: string) {
  if (!value) return "Not checked";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

type PublishSafetyReport = {
  ok: boolean;
  checkedAt: string;
  scannedFiles: number;
  findings: Array<{
    severity: "error" | "warning";
    path: string;
    rule: string;
    detail: string;
  }>;
};

export default function AdvisorySettingsPage() {
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [safety, setSafety] = useState<PublishSafetyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [updatingTool, setUpdatingTool] = useState<LocalCliToolId | null>(null);
  const [updateResult, setUpdateResult] = useState<ToolUpdateResult | null>(null);

  const load = async (probe = false) => {
    if (probe) setProbing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/advisory/model-availability${probe ? "?probe=1" : ""}`, { cache: "no-store" });
      setData(await res.json());
    } finally {
      if (probe) setProbing(false);
      else setLoading(false);
    }
  };

  const loadSafety = async () => {
    setSafetyLoading(true);
    try {
      const res = await fetch("/api/advisory/publish-safety", { cache: "no-store" });
      setSafety(await res.json());
    } finally {
      setSafetyLoading(false);
    }
  };

  const updateTool = async (tool: LocalCliToolId) => {
    const command = data?.tools?.[tool]?.updateCommand;
    if (command && !window.confirm(`Run local CLI update?\n\n${command}`)) return;
    setUpdatingTool(tool);
    setUpdateResult(null);
    try {
      const res = await fetch("/api/advisory/model-availability/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Panely-Local-Update": "1",
        },
        body: JSON.stringify({ tool }),
      });
      const data = await res.json();
      if (data.result) setUpdateResult(data.result);
      if (!res.ok) throw new Error(data.error || data.result?.error || "CLI update failed");
      await load(true);
    } catch (err) {
      setUpdateResult({
        tool,
        ok: false,
        command: "",
        args: [],
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setUpdatingTool(null);
    }
  };

  useEffect(() => {
    void load();
    void loadSafety();
  }, []);

  return (
    <div className="advisory-page" style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-primary)", padding: "28px" }}>
      <main style={{ maxWidth: "980px", margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "24px" }}>
          <div>
            <Link href="/advisory" style={{ color: "var(--text-muted)", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "14px", textDecoration: "none" }}>
              <ArrowLeft size={14} />
              Back to Panely
            </Link>
            <h1 style={{ margin: 0, fontSize: "28px", fontFamily: "var(--font-heading)", letterSpacing: 0 }}>Model Settings</h1>
            <p style={{ margin: "8px 0 0", color: "var(--text-muted)", lineHeight: 1.6, maxWidth: "680px" }}>
              Panely is configured for local CLI routing only. These are the models shown in session setup and the local source each one uses.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              onClick={() => void load()}
              disabled={loading || probing}
              style={{
                minHeight: "38px",
                padding: "0 14px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text-secondary)",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                cursor: loading || probing ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Daily Check
            </button>
            <button
              onClick={() => void load(true)}
              disabled={loading || probing}
              style={{
                minHeight: "38px",
                padding: "0 14px",
                borderRadius: "8px",
                border: "1px solid rgba(99,102,241,0.45)",
                background: "rgba(99,102,241,0.14)",
                color: "#a5b4fc",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                cursor: loading || probing ? "not-allowed" : "pointer",
                fontWeight: 800,
              }}
            >
              <RefreshCw size={14} className={probing ? "animate-spin" : ""} />
              Force Test
            </button>
          </div>
        </header>

        <section style={{ border: "1px solid var(--border)", borderRadius: "10px", background: "var(--surface)", padding: "18px", marginBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <CheckCircle2 size={18} color="#22c55e" />
            <strong>Routing mode</strong>
            <span style={{ color: "#22c55e", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {data?.routing === "local-cli-only" ? "Local CLI only" : "Checking"}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" }}>
            {[
              { id: "claude" as const, label: "Claude" },
              { id: "codex" as const, label: "Codex" },
              { id: "gemini" as const, label: "Gemini" },
              { id: "agy" as const, label: "Antigravity" },
            ].map((tool) => {
              const toolId = tool.id;
              const status = data?.tools?.[toolId];
              const needsAttention = !status?.available || status?.isOutdated || status?.authStatus === "auth-required";
              const canUpdate = Boolean(status?.available && status?.isOutdated && status?.updateCommand);
              const isUpdating = updatingTool === toolId;
              const badge = !status?.available
                ? "Missing"
                : status?.authStatus === "auth-required"
                  ? "Sign in"
                  : status?.isOutdated
                    ? "Update"
                    : "Current";
              return (
                <div key={toolId} style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "12px", background: "var(--surface-elevated)", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    {status?.available && !needsAttention ? <CheckCircle2 size={15} color="#22c55e" /> : <CircleAlert size={15} color="#f59e0b" />}
                    <strong>{tool.label}</strong>
                    {canUpdate ? (
                      <button
                        onClick={() => void updateTool(toolId)}
                        disabled={Boolean(updatingTool)}
                        title={`Run ${status?.updateCommand}`}
                        style={{
                          marginLeft: "auto",
                          border: "1px solid rgba(245,158,11,0.34)",
                          background: "rgba(245,158,11,0.1)",
                          color: "#f59e0b",
                          borderRadius: "999px",
                          padding: "3px 7px",
                          fontSize: "10px",
                          fontWeight: 900,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          cursor: updatingTool ? "not-allowed" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          opacity: updatingTool && !isUpdating ? 0.5 : 1,
                        }}
                      >
                        <RefreshCw size={10} className={isUpdating ? "animate-spin" : ""} />
                        {isUpdating ? "Updating" : "Update"}
                      </button>
                    ) : (
                      <span style={{ marginLeft: "auto", color: needsAttention ? "#f59e0b" : "#22c55e", fontSize: "10px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        {badge}
                      </span>
                    )}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "12px", overflowWrap: "anywhere", lineHeight: 1.5 }}>
                    {status?.available ? status.path : "Not detected"}
                    {status?.version ? <><br />Installed: {status.version}</> : null}
                    {status?.latestVersion ? <><br />Latest: {status.latestVersion}</> : null}
                    {status?.replacementFor ? <><br />Replacement for: {status.replacementFor}</> : null}
                    {status?.authStatus ? <><br />Auth: {status.authStatus}</> : null}
                    {status?.checkedAt ? <><br />Checked: {formatCheckTime(status.checkedAt)}</> : null}
                    {needsAttention && status?.updateCommand ? <><br /><code>{status.updateCommand}</code></> : null}
                    {status?.error ? <><br />{status.error}</> : null}
                  </div>
                </div>
              );
            })}
          </div>
          {updateResult ? (
            <div style={{ marginTop: "12px", border: `1px solid ${updateResult.ok ? "rgba(34,197,94,0.35)" : "rgba(248,113,113,0.35)"}`, borderRadius: "8px", background: updateResult.ok ? "rgba(34,197,94,0.08)" : "rgba(248,113,113,0.08)", padding: "10px", color: "var(--text-secondary)", fontSize: "12px", lineHeight: 1.5 }}>
              <strong style={{ color: updateResult.ok ? "#22c55e" : "#f87171" }}>
                {updateResult.ok ? `${updateResult.tool} updated` : `${updateResult.tool} update failed`}
              </strong>
              {updateResult.command ? <><br /><code>{[updateResult.command, ...updateResult.args].join(" ")}</code></> : null}
              {updateResult.error ? <><br />{updateResult.error}</> : null}
              {updateResult.stderr ? <><br />{updateResult.stderr.slice(0, 400)}</> : null}
            </div>
          ) : null}
        </section>

        <section style={{ border: "1px solid var(--border)", borderRadius: "10px", background: "var(--surface)", padding: "18px", marginBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "14px", marginBottom: safety?.findings?.length ? "14px" : 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                {safety?.ok ? <ShieldCheck size={18} color="#22c55e" /> : <CircleAlert size={18} color="#f59e0b" />}
                <strong>Publish safety</strong>
                <span style={{ color: safety?.ok ? "#22c55e" : "#f59e0b", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {safety ? (safety.ok ? "Safe to publish" : "Needs review") : "Checking"}
                </span>
              </div>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.5 }}>
                {safety ? `Scanned ${safety.scannedFiles} Git publish candidate files.` : "Checking local data and generated artifacts before GitHub publishing."}
              </p>
            </div>
            <button
              onClick={() => void loadSafety()}
              disabled={safetyLoading}
              style={{
                minHeight: "34px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--surface-elevated)",
                color: "var(--text-secondary)",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                cursor: safetyLoading ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              <RefreshCw size={14} className={safetyLoading ? "animate-spin" : ""} />
              Check
            </button>
          </div>
          {safety?.findings?.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {safety.findings.slice(0, 8).map((finding, index) => (
                <div key={`${finding.path}-${finding.rule}-${index}`} style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "10px", background: "var(--surface-elevated)" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ color: finding.severity === "error" ? "#f87171" : "#f59e0b", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>{finding.severity}</span>
                    <code>{finding.path}</code>
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "12px", lineHeight: 1.5 }}>{finding.detail}</div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {(data?.models ?? []).map((model) => (
            <div key={model.id} style={{ display: "grid", gridTemplateColumns: "minmax(180px, 0.8fr) minmax(260px, 1.2fr) 170px", gap: "16px", alignItems: "center", border: "1px solid var(--border)", borderRadius: "10px", background: "var(--surface)", padding: "16px" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: "var(--text-primary)", marginBottom: "4px" }}>{model.name}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>{model.provider} · {model.model}</div>
              </div>
              <div style={{ minWidth: 0, color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--text-primary)" }}>{model.source}</strong>
                <br />
                <span style={{ color: "var(--text-muted)", overflowWrap: "anywhere" }}>{model.cliPath || "No local source configured"}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                  <span style={{ border: "1px solid var(--border)", borderRadius: "999px", padding: "3px 8px", color: "var(--text-secondary)", fontSize: "11px", fontWeight: 800 }}>
                    {formatContextWindow(model.contextWindow)}
                  </span>
                  <span style={{ border: "1px solid var(--border)", borderRadius: "999px", padding: "3px 8px", color: "var(--text-secondary)", fontSize: "11px", fontWeight: 800 }}>
                    Thinking: {model.thinkingLevels?.join(", ") || "unknown"}
                  </span>
                </div>
                {model.intendedUse || model.intent ? (
                  <div style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "7px" }}>{model.intendedUse || model.intent}</div>
                ) : null}
              </div>
              <div style={{ justifySelf: "end", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", color: model.probe ? (model.probe.ok ? "#22c55e" : "#f59e0b") : model.available ? "#22c55e" : "#f59e0b", fontWeight: 800, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
                  {(model.probe ? model.probe.ok : model.available) ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
                  {model.probe ? (model.probe.ok ? "Valid" : "Failed") : model.available ? "Detected" : "Missing"}
                </span>
                {model.probe ? (
                  <span style={{ color: "var(--text-muted)", fontSize: "11px", textTransform: "none", letterSpacing: 0, fontWeight: 700, textAlign: "right", maxWidth: "170px", overflowWrap: "anywhere" }}>
                    {model.probe.ok ? `${(model.probe.durationMs / 1000).toFixed(1)}s${model.probe.cached ? " cached" : ""}` : model.probe.error || "Probe failed"}
                    <br />
                    Checked {formatCheckTime(model.probe.checkedAt)}
                    <br />
                    Next {formatCheckTime(model.probe.nextCheckAt)}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
