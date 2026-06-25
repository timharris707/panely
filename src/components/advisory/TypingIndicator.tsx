"use client";

import { useEffect, useState } from "react";
import { AgentAvatar } from "@/components/AgentAvatar";
import { AGENTS } from "./constants";

interface TypingIndicatorProps {
  agentId: string | null;
  overrideLabel?: string;
  startedAt?: number | null;
}

function formatElapsed(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
}

export default function TypingIndicator({ agentId, overrideLabel, startedAt }: TypingIndicatorProps) {
  const [now, setNow] = useState(() => Date.now());
  const agentDef = agentId ? AGENTS.find((a) => a.id === agentId) : null;
  const label = overrideLabel
    ? overrideLabel
    : agentId
      ? `${agentId} is thinking...`
      : "Agents are deliberating...";
  const elapsedLabel = startedAt ? formatElapsed(now - startedAt) : null;

  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return (
    <div
      className="typing-indicator"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 16px",
        borderRadius: "12px",
        border: "1px solid rgba(139, 92, 246, 0.25)",
        backgroundColor: "rgba(139, 92, 246, 0.06)",
        marginBottom: "12px",
        animation: "msg-fadein 0.2s ease-out",
      }}
    >
      {/* Avatar with pulse ring */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        {agentId ? (
          <>
            <div
              style={{
                position: "absolute",
                inset: "-4px",
                borderRadius: "50%",
                border: "2px solid rgba(139,92,246,0.5)",
                animation: "thinking-pulse 1.2s ease-in-out infinite",
              }}
            />
            <AgentAvatar agentId={agentId} size={32} borderWidth={2} />
          </>
        ) : (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: "rgba(139,92,246,0.15)",
              border: "2px solid rgba(139,92,246,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "thinking-pulse 1.2s ease-in-out infinite",
            }}
          >
            <span style={{ fontSize: "14px" }}>{agentDef?.emoji ?? "💬"}</span>
          </div>
        )}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "5px" }}>
          <span style={{ fontSize: "12px", color: "#a78bfa", fontWeight: 600 }}>
            {label}
          </span>
          {elapsedLabel ? (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 800 }}>
              {elapsedLabel}
            </span>
          ) : null}
        </div>
        {/* Animated dots */}
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#8b5cf6",
                animation: `typing-dot 1.2s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
