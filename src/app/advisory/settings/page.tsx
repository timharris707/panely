"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert, RefreshCw } from "lucide-react";
import "@/styles/advisory.css";

type ToolStatus = {
  available: boolean;
  path?: string;
  version?: string;
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
};

type AvailabilityResponse = {
  tools: Record<string, ToolStatus>;
  models: ModelStatus[];
  routing: string;
};

export default function AdvisorySettingsPage() {
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/advisory/model-availability", { cache: "no-store" });
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
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
          <button
            onClick={() => void load()}
            disabled={loading}
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
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        <section style={{ border: "1px solid var(--border)", borderRadius: "10px", background: "var(--surface)", padding: "18px", marginBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <CheckCircle2 size={18} color="#22c55e" />
            <strong>Routing mode</strong>
            <span style={{ color: "#22c55e", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {data?.routing === "local-cli-only" ? "Local CLI only" : "Checking"}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px" }}>
            {["claude", "codex", "gemini"].map((tool) => {
              const status = data?.tools?.[tool];
              return (
                <div key={tool} style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "12px", background: "var(--surface-elevated)", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    {status?.available ? <CheckCircle2 size={15} color="#22c55e" /> : <CircleAlert size={15} color="#f59e0b" />}
                    <strong style={{ textTransform: "capitalize" }}>{tool}</strong>
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "12px", overflowWrap: "anywhere", lineHeight: 1.5 }}>
                    {status?.available ? status.path : "Not detected"}
                    {status?.version ? <><br />{status.version}</> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {(data?.models ?? []).map((model) => (
            <div key={model.id} style={{ display: "grid", gridTemplateColumns: "minmax(180px, 0.8fr) minmax(180px, 1fr) 130px", gap: "16px", alignItems: "center", border: "1px solid var(--border)", borderRadius: "10px", background: "var(--surface)", padding: "16px" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: "var(--text-primary)", marginBottom: "4px" }}>{model.name}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>{model.provider} · {model.model}</div>
              </div>
              <div style={{ minWidth: 0, color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--text-primary)" }}>{model.source}</strong>
                <br />
                <span style={{ color: "var(--text-muted)", overflowWrap: "anywhere" }}>{model.cliPath || "No local source configured"}</span>
              </div>
              <div style={{ justifySelf: "end", display: "inline-flex", alignItems: "center", gap: "7px", color: model.available ? "#22c55e" : "#f59e0b", fontWeight: 800, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {model.available ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
                {model.available ? "Available" : "Missing"}
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
