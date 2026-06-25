"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Copy,
  AlertCircle,
  RotateCcw,
  GitBranch,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { AgentAvatar } from "@/components/AgentAvatar";
import { getAgentByAnyId } from "@/config/agents";
import type { AdvisoryEvent } from "@/types/advisory";
import {
  PERSONA_OVERLAYS,
  getAgentRole,
  getOverlayName,
  getOverlayEmoji,
  getEventStyle,
  getEventIcon,
  getRoleBadge,
  formatTime,
  formatModelName,
} from "./constants";

interface AIPersonaMeta {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

interface CustomAgentMeta {
  emoji: string;
  role: string;
  persona?: string;
}

interface EventBubbleProps {
  event: AdvisoryEvent;
  sessionOverlays?: Record<string, string> | string[];
  sessionTopic?: string;
  sessionMode?: string;
  aiPersonas?: AIPersonaMeta[];
  customAgentMeta?: Record<string, CustomAgentMeta>;
  onRetry?: () => void;
  onFork?: () => void;
}

export default function EventBubble({
  event,
  sessionOverlays = {},
  sessionTopic,
  sessionMode,
  aiPersonas,
  customAgentMeta,
  onRetry,
  onFork,
}: EventBubbleProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [hovered, setHovered] = useState(false);
  const [ratingState, setRatingState] = useState<"up" | "down" | null>(null);

  const handleRate = async (rating: "up" | "down") => {
    if (ratingState === rating) return;
    setRatingState(rating);
    try {
      await fetch("/api/advisory/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: event.speaker, rating, topic: sessionTopic }),
      });
    } catch {
      // ignore — non-critical
    }
  };

  const isHuman = event.speaker === "the user";
  const isError = event.type === "error" || event.error === true;
  const style = getEventStyle(event);
  const icon = getEventIcon(event.type, event.verdict);
  const badge = getRoleBadge(event.role, event.type, event.speaker);
  const isSystem = event.type === "start" || event.type === "complete";
  const agentConfig = isHuman ? null : getAgentByAnyId(event.speaker);
  const agentRole = agentConfig?.role ?? customAgentMeta?.[event.speaker]?.role ?? getAgentRole(event.speaker);

  const displayText = isHuman
    ? event.text.replace(/^\*\*\[Human Directive\]\*\*\s*/i, "").trim()
    : event.text;

  const speakerOverlays: string[] = isHuman ? [] : (() => {
    if (!sessionOverlays) return [];
    if (Array.isArray(sessionOverlays)) {
      return sessionOverlays.filter((oid) => {
        // AI-generated personas apply to all agents
        if (oid.startsWith("ai-")) return true;
        const o = PERSONA_OVERLAYS.find((p) => p.id === oid);
        return o?.relevantAgents.includes(event.speaker);
      });
    }
    const overlayId = sessionOverlays[event.speaker];
    return overlayId ? [overlayId] : [];
  })();

  const durationLabel = typeof event.durationMs === "number"
    ? event.durationMs < 1000
      ? `${event.durationMs}ms`
      : `${(event.durationMs / 1000).toFixed(1)}s`
    : null;

  // Helper to resolve overlay name/emoji for both static and AI-generated personas
  const resolveOverlayName = (oid: string): string => {
    if (oid.startsWith("ai-") && aiPersonas) {
      const ai = aiPersonas.find((p) => p.id === oid);
      if (ai) return ai.name;
    }
    return getOverlayName(oid);
  };
  const resolveOverlayEmoji = (oid: string): string => {
    if (oid.startsWith("ai-") && aiPersonas) {
      const ai = aiPersonas.find((p) => p.id === oid);
      if (ai) return ai.emoji;
    }
    return getOverlayEmoji(oid);
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(displayText);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      className="advisory-event-bubble"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "14px 16px",
        borderRadius: "12px",
        border: `1px solid ${style.border}`,
        backgroundColor: style.bg,
        marginBottom: "12px",
        position: "relative",
        maxWidth: "100%",
        overflow: "hidden",
      }}
    >
      {/* Action buttons removed from absolute position — now inline with timestamp */}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "8px" }}>
        {/* Avatar */}
        <div style={{ flexShrink: 0, marginTop: "1px" }}>
          {isError ? (
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              backgroundColor: "rgba(239,68,68,0.15)",
              border: "2px solid rgba(239,68,68,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <AlertCircle size={16} color="#ef4444" />
            </div>
          ) : isHuman ? (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: "rgba(251,191,36,0.15)",
                border: "2px solid rgba(251,191,36,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 700,
                color: "#fbbf24",
                fontFamily: "var(--font-heading)",
              }}
            >
              T
            </div>
          ) : isSystem ? (
            <span style={{ fontSize: "20px", lineHeight: 1, display: "block" }}>{icon}</span>
          ) : agentConfig ? (
            <AgentAvatar agentId={event.speaker} size={36} borderWidth={2} />
          ) : (
            <span style={{ fontSize: "20px", lineHeight: 1, display: "block" }}>{event.emoji}</span>
          )}
        </div>

        {/* Name + role line + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "2px" }}>
            <span style={{ fontWeight: 700, fontSize: "13px", color: isError ? "#ef4444" : isHuman ? "#fbbf24" : "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
              {isError ? "Session Error" : isHuman ? "User" : event.speaker}
            </span>
            {!isSystem && !isHuman && !isError && (
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                — {agentRole}
              </span>
            )}
            {isHuman && (
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                — CEO
              </span>
            )}
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {formatTime(event.timestamp)}
              </span>
              {!isSystem && !isError && (hovered || copyState === "copied") && (
                <>
                  {onFork && hovered && (
                    <button
                      onClick={onFork}
                      title="Fork from here — create a new session branching from this point"
                      style={{
                        padding: "4px 8px",
                        borderRadius: "6px",
                        border: "1px solid rgba(139,92,246,0.3)",
                        backgroundColor: "rgba(139,92,246,0.08)",
                        color: "#a78bfa",
                        cursor: "pointer",
                        fontSize: "10px",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        transition: "all 150ms ease",
                      }}
                    >
                      <GitBranch size={11} />
                      Fork
                    </button>
                  )}
                  <button
                    onClick={handleCopyMessage}
                    title="Copy message"
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: `1px solid ${copyState === "copied" ? "rgba(74,222,128,0.5)" : "var(--border)"}`,
                      backgroundColor: copyState === "copied" ? "rgba(74,222,128,0.12)" : "var(--surface-elevated)",
                      color: copyState === "copied" ? "#4ade80" : "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: "10px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      transition: "all 150ms ease",
                    }}
                  >
                    <Copy size={11} />
                    {copyState === "copied" ? "Copied!" : "Copy"}
                  </button>
                </>
              )}
            </span>
          </div>

          {/* Role badge + overlay chips */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
            {isError ? (
              <span style={{
                fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em",
                color: "#ef4444", backgroundColor: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.4)", padding: "2px 6px",
                borderRadius: "4px", fontFamily: "var(--font-mono)",
              }}>ERROR</span>
            ) : (sessionMode === "roundtable" && (badge.label === "WORKER" || badge.label === "SUPERVISOR")) ? null : (
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: badge.color,
                  backgroundColor: `${badge.color}18`,
                  border: `1px solid ${badge.color}40`,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {badge.label}
              </span>
            )}
            {speakerOverlays.map((oid) => (
              <span
                key={oid}
                style={{
                  fontSize: "9px",
                  fontWeight: 600,
                  color: "#a78bfa",
                  backgroundColor: "rgba(167,139,250,0.12)",
                  border: "1px solid rgba(167,139,250,0.3)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.04em",
                }}
              >
                {resolveOverlayEmoji(oid)} {resolveOverlayName(oid)}
              </span>
            ))}
            {event.model && !isSystem && !isHuman && (
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 500,
                  color: "#64748b",
                  backgroundColor: "rgba(100,116,139,0.08)",
                  border: "1px solid rgba(100,116,139,0.2)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.03em",
                }}
              >
                {formatModelName(event.model)}
              </span>
            )}
            {durationLabel && !isSystem && !isHuman && (
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 500,
                  color: isError ? "#fca5a5" : "#64748b",
                  backgroundColor: isError ? "rgba(239,68,68,0.1)" : "rgba(100,116,139,0.08)",
                  border: isError ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(100,116,139,0.2)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.03em",
                }}
              >
                {durationLabel}
              </span>
            )}
            {event.errorKind && (
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "#fca5a5",
                  backgroundColor: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.04em",
                }}
              >
                {event.errorKind}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        style={{ fontSize: "13px", color: isError ? "#fca5a5" : "var(--text-primary)", lineHeight: 1.6, marginLeft: "46px", maxWidth: "100%", overflow: "hidden", wordBreak: "normal", overflowWrap: "break-word" }}
        className="advisory-markdown"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
      </div>

      {/* Rating buttons */}
      {!isSystem && !isHuman && !isError && (
        <div style={{ marginLeft: "46px", marginTop: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={() => handleRate("up")}
            title="Good response"
            style={{
              padding: "3px 8px",
              borderRadius: "6px",
              border: `1px solid ${ratingState === "up" ? "rgba(74,222,128,0.5)" : "var(--border)"}`,
              backgroundColor: ratingState === "up" ? "rgba(74,222,128,0.12)" : "transparent",
              color: ratingState === "up" ? "#4ade80" : "var(--text-muted)",
              cursor: "pointer",
              fontSize: "10px",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              transition: "all 150ms ease",
              opacity: ratingState === "down" ? 0.4 : 1,
            }}
          >
            <ThumbsUp size={11} />
          </button>
          <button
            onClick={() => handleRate("down")}
            title="Needs improvement"
            style={{
              padding: "3px 8px",
              borderRadius: "6px",
              border: `1px solid ${ratingState === "down" ? "rgba(239,68,68,0.5)" : "var(--border)"}`,
              backgroundColor: ratingState === "down" ? "rgba(239,68,68,0.12)" : "transparent",
              color: ratingState === "down" ? "#ef4444" : "var(--text-muted)",
              cursor: "pointer",
              fontSize: "10px",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              transition: "all 150ms ease",
              opacity: ratingState === "up" ? 0.4 : 1,
            }}
          >
            <ThumbsDown size={11} />
          </button>
        </div>
      )}

      {/* Retry button for errors */}
      {isError && onRetry && (
        <div style={{ marginLeft: "46px", marginTop: "10px" }}>
          <button
            onClick={onRetry}
            style={{
              padding: "6px 14px",
              borderRadius: "7px",
              border: "1px solid rgba(239,68,68,0.5)",
              backgroundColor: "rgba(239,68,68,0.12)",
              color: "#ef4444",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 150ms ease",
            }}
          >
            <RotateCcw size={11} />
            Retry Session
          </button>
        </div>
      )}
    </div>
  );
}
