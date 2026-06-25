"use client";

import { useState } from "react";
import { Loader2, Focus } from "lucide-react";
import { AgentAvatar } from "@/components/AgentAvatar";
import { getAgentByAnyId } from "@/config/agents";
import { MODELS } from "./constants";

interface DeepDiveModalProps {
  agent: { id: string; name: string; emoji: string; role: string };
  onClose: () => void;
  onLaunch: (topic: string, model: string) => Promise<void>;
}

export default function DeepDiveModal({ agent, onClose, onLaunch }: DeepDiveModalProps) {
  const [topic, setTopic] = useState("");
  const [model, setModel] = useState("claude-sonnet");
  const [launching, setLaunching] = useState(false);

  const handleLaunch = async () => {
    if (!topic.trim()) return;
    setLaunching(true);
    try {
      await onLaunch(topic, model);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: "20px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid rgba(16,185,129,0.3)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "500px",
          padding: "32px",
        }}
      >
        {/* Agent showcase */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ marginBottom: "12px" }}>
            {getAgentByAnyId(agent.id) ? (
              <AgentAvatar agentId={agent.id} size={72} borderWidth={3} />
            ) : (
              <div style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                backgroundColor: "rgba(16,185,129,0.12)",
                border: "3px solid rgba(16,185,129,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "32px",
                margin: "0 auto",
              }}>
                {agent.emoji}
              </div>
            )}
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px 0", fontFamily: "var(--font-heading)" }}>
            Deep Dive with {agent.name}
          </h2>
          <div style={{ fontSize: "12px", color: "#10b981", fontWeight: 600 }}>
            {agent.role}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            1-on-1 focused consultation · Persistent session
          </div>
        </div>

        {/* Topic */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "6px", fontFamily: "var(--font-mono)" }}>
            TOPIC
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={`What would you like to discuss with ${agent.name}?`}
            rows={3}
            autoFocus
            style={{
              width: "100%",
              padding: "12px 14px",
              backgroundColor: "var(--surface-elevated)",
              border: "1px solid rgba(16,185,129,0.25)",
              borderRadius: "10px",
              color: "var(--text-primary)",
              fontSize: "14px",
              fontFamily: "var(--font-body)",
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
              lineHeight: 1.6,
            }}
          />
        </div>

        {/* Model selection */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "6px", fontFamily: "var(--font-mono)" }}>
            MODEL
          </label>
          <div style={{ display: "flex", gap: "6px" }}>
            {MODELS.map((m) => {
              const sel = model === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: `1px solid ${sel ? "rgba(16,185,129,0.5)" : "var(--border)"}`,
                    backgroundColor: sel ? "rgba(16,185,129,0.1)" : "var(--surface-elevated)",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 150ms ease",
                  }}
                >
                  <div style={{ fontSize: "10px", fontWeight: 700, color: sel ? "#10b981" : "var(--text-primary)" }}>{m.label.split(" (")[0]}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: "13px", fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={handleLaunch}
            disabled={launching || !topic.trim()}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#10b981",
              color: "#fff",
              cursor: launching || !topic.trim() ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              opacity: launching || !topic.trim() ? 0.6 : 1,
              fontFamily: "var(--font-heading)",
            }}
          >
            {launching ? <Loader2 size={14} className="animate-spin" /> : <Focus size={14} />}
            Start Deep Dive
          </button>
        </div>
      </div>
    </div>
  );
}
