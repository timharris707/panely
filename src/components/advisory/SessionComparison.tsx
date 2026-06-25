"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Columns2 } from "lucide-react";
import { AgentAvatar, AvatarStack } from "@/components/AgentAvatar";
import { getAgentByAnyId } from "@/config/agents";
import type { AdvisorySession, AdvisoryEvent } from "@/types/advisory";
import { getEventStyle, formatTime } from "./constants";

interface SessionComparisonProps {
  sessions: [AdvisorySession, AdvisorySession];
  onClose: () => void;
}

export default function SessionComparison({ sessions, onClose }: SessionComparisonProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
        padding: "20px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "1200px",
          height: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Columns2 size={18} color="#60a5fa" />
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-heading)" }}>
              Session Comparison
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}>
            <X size={20} />
          </button>
        </div>

        {/* Side-by-side panels */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {sessions.map((sess, idx) => {
            const sessEvents = (sess.events || []) as AdvisoryEvent[];
            const sessionData = sess as unknown as Record<string, unknown>;
            return (
              <div
                key={sess.id || idx}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  borderRight: idx === 0 ? "1px solid var(--border)" : "none",
                  overflow: "hidden",
                }}
              >
                {/* Session header */}
                <div style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border)",
                  backgroundColor: idx === 0 ? "rgba(96,165,250,0.04)" : "rgba(167,139,250,0.04)",
                  flexShrink: 0,
                }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px", lineHeight: 1.4 }}>
                    {sess.title || sess.topic}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "6px" }}>
                    <span style={{
                      fontSize: "8px", fontWeight: 700, letterSpacing: "0.06em",
                      color: "#60a5fa", backgroundColor: "rgba(96,165,250,0.12)",
                      border: "1px solid rgba(96,165,250,0.3)", padding: "2px 5px",
                      borderRadius: "3px", fontFamily: "var(--font-mono)",
                    }}>{sess.mode}</span>
                    {sess.model && (
                      <span style={{
                        fontSize: "8px", fontWeight: 600,
                        color: "var(--text-muted)", backgroundColor: "rgba(100,116,139,0.08)",
                        border: "1px solid rgba(100,116,139,0.2)", padding: "2px 5px",
                        borderRadius: "3px", fontFamily: "var(--font-mono)",
                      }}>{sess.model}</span>
                    )}
                    {!!sessionData.responseLength && (
                      <span style={{
                        fontSize: "8px", fontWeight: 600,
                        color: "var(--text-muted)", backgroundColor: "rgba(100,116,139,0.08)",
                        border: "1px solid rgba(100,116,139,0.2)", padding: "2px 5px",
                        borderRadius: "3px", fontFamily: "var(--font-mono)",
                      }}>{String(sessionData.responseLength)}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <AvatarStack agentIds={sess.agents} size={20} max={5} />
                    <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                      {sess.agents.join(", ")} · {sessEvents.length} events
                    </span>
                  </div>
                  {sess.outcome && (
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
                      Outcome: {sess.outcome}
                    </div>
                  )}
                </div>

                {/* Events scroll */}
                <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
                  {sessEvents.filter((e) => e.text && e.speaker).map((event) => {
                    const evtStyle = getEventStyle(event);
                    const agentConfig = event.speaker !== "the user" ? getAgentByAnyId(event.speaker) : null;
                    const isHuman = event.speaker === "the user";
                    const isSystem = event.type === "start" || event.type === "complete";
                    const displayText = isHuman
                      ? event.text.replace(/^\*\*\[Human Directive\]\*\*\s*/i, "").trim()
                      : event.text;

                    return (
                      <div
                        key={event.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "10px",
                          border: `1px solid ${evtStyle.border}`,
                          backgroundColor: evtStyle.bg,
                          marginBottom: "8px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          {isHuman ? (
                            <div style={{
                              width: 24, height: 24, borderRadius: "50%",
                              backgroundColor: "rgba(251,191,36,0.15)", border: "2px solid rgba(251,191,36,0.5)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "10px", fontWeight: 700, color: "#fbbf24",
                            }}>T</div>
                          ) : isSystem ? (
                            <span style={{ fontSize: "14px" }}>{event.emoji}</span>
                          ) : agentConfig ? (
                            <AgentAvatar agentId={event.speaker} size={24} borderWidth={2} />
                          ) : (
                            <span style={{ fontSize: "14px" }}>{event.emoji}</span>
                          )}
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-primary)" }}>
                            {isHuman ? "User" : event.speaker}
                          </span>
                          <span style={{ fontSize: "9px", color: "var(--text-muted)", marginLeft: "auto" }}>
                            {formatTime(event.timestamp)}
                          </span>
                        </div>
                        <div
                          style={{ fontSize: "11px", color: "var(--text-primary)", lineHeight: 1.6, marginLeft: "32px" }}
                          className="advisory-markdown"
                        >
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
