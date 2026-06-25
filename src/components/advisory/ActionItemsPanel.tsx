"use client";

import { useState } from "react";
import { Zap, CalendarDays, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { AgentAvatar } from "@/components/AgentAvatar";
import { getAgentByAnyId } from "@/config/agents";
import type { DetailedActionItem } from "@/types/advisory";

interface ActionItemsPanelProps {
  actions: DetailedActionItem[];
  onPushTask: (action: DetailedActionItem, mode: "now" | "schedule") => Promise<void>;
  onSkip: (actionId: string) => void;
}

const priorityBorder: Record<string, string> = {
  high: "#ef4444",
  medium: "#fbbf24",
  low: "#4ade80",
};

const priorityColor: Record<string, string> = {
  high: "#ef4444",
  medium: "#fbbf24",
  low: "#94a3b8",
};

const priorityBg: Record<string, string> = {
  high: "rgba(239,68,68,0.12)",
  medium: "rgba(251,191,36,0.12)",
  low: "rgba(148,163,184,0.1)",
};

export default function ActionItemsPanel({
  actions,
  onPushTask,
  onSkip,
}: ActionItemsPanelProps) {
  const [pushing, setPushing] = useState<Record<string, string>>({});

  const handlePush = async (action: DetailedActionItem, mode: "now" | "schedule") => {
    setPushing((p) => ({ ...p, [action.id]: mode }));
    try {
      await onPushTask(action, mode);
    } finally {
      setPushing((p) => {
        const next = { ...p };
        delete next[action.id];
        return next;
      });
    }
  };

  const visible = actions.filter((a) => a.status === "pending");
  const pushed = actions.filter((a) => a.status === "pushed");
  const skipped = actions.filter((a) => a.status === "skipped");

  if (actions.length === 0) return null;

  return (
    <div style={{
      margin: "16px 0",
      borderRadius: "12px",
      border: "1px solid rgba(10,132,255,0.3)",
      backgroundColor: "rgba(10,132,255,0.03)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        borderBottom: visible.length > 0 ? "1px solid rgba(10,132,255,0.15)" : "none",
      }}>
        <Zap size={14} color="#0A84FF" />
        <span style={{
          fontSize: "13px",
          fontWeight: 700,
          color: "#0A84FF",
          fontFamily: "var(--font-heading)",
          flex: 1,
        }}>
          Action Items
        </span>
        <span style={{
          fontSize: "9px",
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono)",
        }}>
          {visible.length} pending
          {pushed.length > 0 && ` · ${pushed.length} pushed`}
          {skipped.length > 0 && ` · ${skipped.length} skipped`}
        </span>
      </div>

      {/* Action item cards */}
      {visible.length > 0 && (
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {visible.map((action) => {
            const agent = getAgentByAnyId(action.assignedAgent);
            const isPushing = pushing[action.id];

            return (
              <div
                key={action.id}
                style={{
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-elevated)",
                  borderLeft: `3px solid ${priorityBorder[action.priority] || "#6b7280"}`,
                  padding: "12px 14px",
                  opacity: isPushing ? 0.7 : 1,
                  transition: "opacity 150ms ease",
                }}
              >
                {/* Title row */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                  {agent && (
                    <AgentAvatar agentId={agent.id} size={24} borderWidth={1} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-heading)",
                      lineHeight: 1.3,
                    }}>
                      {action.title}
                    </div>
                  </div>
                  <span style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    color: priorityColor[action.priority],
                    backgroundColor: priorityBg[action.priority],
                    padding: "2px 6px",
                    borderRadius: "3px",
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.04em",
                    flexShrink: 0,
                  }}>
                    {action.priority.toUpperCase()}
                  </span>
                </div>

                {/* Description */}
                <div style={{
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                  marginBottom: "8px",
                }}>
                  {action.description}
                </div>

                {/* Meta row */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "10px",
                  flexWrap: "wrap",
                }}>
                  <span style={{
                    fontSize: "9px",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    backgroundColor: "rgba(100,116,139,0.08)",
                    padding: "2px 6px",
                    borderRadius: "3px",
                    fontFamily: "var(--font-mono)",
                  }}>
                    {action.assignedAgent}
                  </span>
                  {action.suggestedDeadline && action.suggestedDeadline !== "none" && (
                    <span style={{
                      fontSize: "9px",
                      fontWeight: 600,
                      color: "#fbbf24",
                      backgroundColor: "rgba(251,191,36,0.08)",
                      padding: "2px 6px",
                      borderRadius: "3px",
                      fontFamily: "var(--font-mono)",
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                    }}>
                      <CalendarDays size={9} />
                      {action.suggestedDeadline}
                    </span>
                  )}
                  {action.source && (
                    <span style={{
                      fontSize: "9px",
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                      opacity: 0.7,
                    }}>
                      {action.source}
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => handlePush(action, "now")}
                    disabled={!!isPushing}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 12px",
                      borderRadius: "6px",
                      border: "1px solid rgba(255,59,48,0.4)",
                      backgroundColor: "rgba(255,59,48,0.1)",
                      color: "#FF3B30",
                      cursor: isPushing ? "wait" : "pointer",
                      fontSize: "11px",
                      fontWeight: 700,
                      fontFamily: "var(--font-heading)",
                      transition: "all 150ms ease",
                    }}
                  >
                    {isPushing === "now" ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Zap size={11} />
                    )}
                    Now
                  </button>
                  <button
                    onClick={() => handlePush(action, "schedule")}
                    disabled={!!isPushing}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 12px",
                      borderRadius: "6px",
                      border: "1px solid rgba(10,132,255,0.4)",
                      backgroundColor: "rgba(10,132,255,0.1)",
                      color: "#0A84FF",
                      cursor: isPushing ? "wait" : "pointer",
                      fontSize: "11px",
                      fontWeight: 700,
                      fontFamily: "var(--font-heading)",
                      transition: "all 150ms ease",
                    }}
                  >
                    {isPushing === "schedule" ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <CalendarDays size={11} />
                    )}
                    Schedule
                  </button>
                  <button
                    onClick={() => onSkip(action.id)}
                    disabled={!!isPushing}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(107,114,128,0.3)",
                      backgroundColor: "transparent",
                      color: "var(--text-muted)",
                      cursor: isPushing ? "wait" : "pointer",
                      fontSize: "11px",
                      fontWeight: 600,
                      fontFamily: "var(--font-heading)",
                      transition: "all 150ms ease",
                    }}
                  >
                    <Trash2 size={10} />
                    Skip
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pushed items summary */}
      {pushed.length > 0 && visible.length === 0 && (
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <CheckCircle2 size={14} color="#4ade80" />
          <span style={{ fontSize: "12px", color: "#4ade80", fontWeight: 600 }}>
            All action items have been processed
          </span>
        </div>
      )}
    </div>
  );
}
