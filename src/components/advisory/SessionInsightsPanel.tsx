"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Loader2,
  ChevronRight,
  ChevronDown,
  Lightbulb,
  Clock,
  AlertTriangle,
} from "lucide-react";
import type { SessionInsights } from "@/types/advisory";

interface SessionInsightsPanelProps {
  insights: SessionInsights | null;
  onToggleAction: (index: number, status: "pending" | "done") => void;
  extracting: boolean;
  onExtract: () => void;
}

export default function SessionInsightsPanel({
  insights,
  onToggleAction,
  extracting,
  onExtract,
}: SessionInsightsPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (!insights && !extracting) {
    return (
      <div style={{ margin: "16px 0", padding: "12px 16px", borderRadius: "12px", border: "1px solid rgba(251,191,36,0.25)", backgroundColor: "rgba(251,191,36,0.04)" }}>
        <button
          onClick={onExtract}
          style={{
            display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none",
            cursor: "pointer", color: "#fbbf24", fontSize: "12px", fontWeight: 700, padding: 0,
            fontFamily: "var(--font-heading)",
          }}
        >
          <Lightbulb size={14} />
          Extract Insights
        </button>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
          Analyze conversation for action items, decisions, open questions, and risks
        </div>
      </div>
    );
  }

  if (extracting) {
    return (
      <div style={{ margin: "16px 0", padding: "16px", borderRadius: "12px", border: "1px solid rgba(251,191,36,0.3)", backgroundColor: "rgba(251,191,36,0.06)", display: "flex", alignItems: "center", gap: "10px" }}>
        <Loader2 size={16} color="#fbbf24" className="animate-spin" />
        <span style={{ fontSize: "12px", color: "#fbbf24", fontWeight: 600 }}>Extracting insights from conversation...</span>
      </div>
    );
  }

  if (!insights) return null;

  const priorityColor = (p: string) => p === "high" ? "#ef4444" : p === "medium" ? "#fbbf24" : "#94a3b8";
  const priorityBg = (p: string) => p === "high" ? "rgba(239,68,68,0.12)" : p === "medium" ? "rgba(251,191,36,0.12)" : "rgba(148,163,184,0.1)";

  return (
    <div style={{ margin: "16px 0", borderRadius: "12px", border: "1px solid rgba(251,191,36,0.3)", backgroundColor: "rgba(251,191,36,0.03)", overflow: "hidden" }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%", padding: "12px 16px", display: "flex", alignItems: "center", gap: "8px",
          background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <Lightbulb size={14} color="#fbbf24" />
        <span style={{ fontSize: "13px", fontWeight: 700, color: "#fbbf24", fontFamily: "var(--font-heading)", flex: 1 }}>
          Session Insights
        </span>
        <span style={{ fontSize: "9px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          {insights.actionItems.length} actions · {insights.keyDecisions.length} decisions
        </span>
        {expanded ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 16px" }}>
          {insights.actionItems.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: "8px" }}>
                ACTION ITEMS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {insights.actionItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: "8px", padding: "8px 10px",
                      borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "var(--surface-elevated)",
                      opacity: item.status === "done" ? 0.6 : 1,
                    }}
                  >
                    <button
                      onClick={() => onToggleAction(idx, item.status === "done" ? "pending" : "done")}
                      style={{
                        flexShrink: 0, width: 18, height: 18, borderRadius: "4px", marginTop: "1px",
                        border: `2px solid ${item.status === "done" ? "#4ade80" : "var(--border)"}`,
                        backgroundColor: item.status === "done" ? "#4ade80" : "transparent",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {item.status === "done" && <CheckCircle2 size={12} color="#fff" />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.5, textDecoration: item.status === "done" ? "line-through" : "none" }}>
                        {item.description}
                      </div>
                      <div style={{ display: "flex", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "9px", fontWeight: 700, color: priorityColor(item.priority), backgroundColor: priorityBg(item.priority), padding: "1px 6px", borderRadius: "3px", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                          {item.priority.toUpperCase()}
                        </span>
                        <span style={{ fontSize: "9px", fontWeight: 600, color: "var(--text-muted)", backgroundColor: "rgba(100,116,139,0.08)", padding: "1px 6px", borderRadius: "3px", fontFamily: "var(--font-mono)" }}>
                          {item.assignedAgent}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {insights.keyDecisions.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: "8px" }}>
                KEY DECISIONS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {insights.keyDecisions.map((d, idx) => (
                  <div key={idx} style={{ fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.5, padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(74,222,128,0.2)", backgroundColor: "rgba(74,222,128,0.04)", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                    <CheckCircle2 size={12} color="#4ade80" style={{ flexShrink: 0, marginTop: "2px" }} />
                    {d}
                  </div>
                ))}
              </div>
            </div>
          )}

          {insights.openQuestions.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: "8px" }}>
                OPEN QUESTIONS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {insights.openQuestions.map((q, idx) => (
                  <div key={idx} style={{ fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.5, padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(96,165,250,0.2)", backgroundColor: "rgba(96,165,250,0.04)", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                    <Clock size={12} color="#60a5fa" style={{ flexShrink: 0, marginTop: "2px" }} />
                    {q}
                  </div>
                ))}
              </div>
            </div>
          )}

          {insights.risksIdentified.length > 0 && (
            <div>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: "8px" }}>
                RISKS IDENTIFIED
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {insights.risksIdentified.map((r, idx) => (
                  <div key={idx} style={{ fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.5, padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(239,68,68,0.2)", backgroundColor: "rgba(239,68,68,0.04)", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                    <AlertTriangle size={12} color="#ef4444" style={{ flexShrink: 0, marginTop: "2px" }} />
                    {r}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "12px", fontFamily: "var(--font-mono)", opacity: 0.7 }}>
            Extracted {new Date(insights.extractedAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
