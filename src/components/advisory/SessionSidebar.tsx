"use client";

import {
  Users,
  X,
  RefreshCw,
  MessageSquarePlus,
  Radio,
  History,
  Search,
  Loader2,
  GitBranch,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { AvatarStack } from "@/components/AgentAvatar";
import type { AdvisorySession } from "@/types/advisory";
import { MODELS, getStatusBadge, formatDate } from "./constants";

const MODEL_SHORT: Record<string, string> = Object.fromEntries(
  MODELS.map((m) => [m.id, m.label.replace(/ \(.*\)$/, "")])
);

// ─── Session List Item ───────────────────────────────────────────────────────

function SessionListItem({
  session,
  active,
  onClick,
}: {
  session: AdvisorySession;
  active: boolean;
  onClick: () => void;
}) {
  const badge = getStatusBadge(session.status);

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "12px 14px",
        borderRadius: "10px",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        backgroundColor: active ? "var(--accent-soft)" : "transparent",
        cursor: "pointer",
        transition: "all 150ms ease",
        marginBottom: "6px",
        display: "block",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
        <span
          style={{
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: badge.color,
            backgroundColor: badge.bg,
            padding: "2px 6px",
            borderRadius: "4px",
            fontFamily: "var(--font-mono)",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {session.status === "active" && (
            <span className="live-dot" style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: badge.color, display: "inline-block", flexShrink: 0 }} />
          )}
          {badge.label}
        </span>
        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
          {formatDate(session.createdAt)}
        </span>
      </div>
      <div
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: "6px",
          lineHeight: 1.4,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        } as React.CSSProperties}
      >
        {session.title || session.topic}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <AvatarStack agentIds={session.agents} size={22} max={4} />
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {!!(session as unknown as Record<string, unknown>).forkedFrom && (
            <span style={{
              fontSize: "8px", fontWeight: 700, color: "#60a5fa",
              backgroundColor: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)",
              padding: "1px 5px", borderRadius: "3px", fontFamily: "var(--font-mono)",
              letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: "2px",
            }}>
              <GitBranch size={7} />
            </span>
          )}
          {(session as unknown as Record<string, unknown>).specialist ? (
            <span style={{
              fontSize: "8px", fontWeight: 700, color: "#10b981",
              backgroundColor: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)",
              padding: "1px 5px", borderRadius: "3px", fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
            }}>1:1</span>
          ) : (session as unknown as Record<string, unknown>).rounds === "persistent" && (
            <span style={{
              fontSize: "8px", fontWeight: 700, color: "#a78bfa",
              backgroundColor: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)",
              padding: "1px 5px", borderRadius: "3px", fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
            }}>∞</span>
          )}
          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
            {session.eventCount ?? session.events?.length ?? 0} events
          </span>
        </div>
      </div>
      {/* Settings badges — model, rounds, response length */}
      {(() => {
        const sd = session as unknown as Record<string, unknown>;
        const model = session.model;
        const rounds = typeof sd.rounds === "number" ? sd.rounds : null;
        const responseLength = typeof sd.responseLength === "string" ? sd.responseLength : null;
        if (!model && !rounds && !responseLength) return null;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "5px", flexWrap: "wrap" }}>
            {model && (
              <span title={model} style={{
                fontSize: "8px", fontWeight: 700, color: "#818cf8",
                backgroundColor: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.2)",
                padding: "1px 5px", borderRadius: "3px", fontFamily: "var(--font-mono)",
              }}>
                {MODEL_SHORT[model] ?? model}
              </span>
            )}
            {rounds !== null && (
              <span style={{
                fontSize: "8px", fontWeight: 700, color: "#fb923c",
                backgroundColor: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.2)",
                padding: "1px 5px", borderRadius: "3px", fontFamily: "var(--font-mono)",
              }}>
                {rounds}R
              </span>
            )}
            {responseLength && (
              <span style={{
                fontSize: "8px", fontWeight: 700, color: "#34d399",
                backgroundColor: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)",
                padding: "1px 5px", borderRadius: "3px", fontFamily: "var(--font-mono)", textTransform: "uppercase",
              }}>
                {responseLength}
              </span>
            )}
          </div>
        );
      })()}
    </button>
  );
}

// ─── Session Sidebar ─────────────────────────────────────────────────────────

interface SessionSidebarProps {
  sessions: AdvisorySession[];
  activeSession: AdvisorySession | null;
  activeView: "live" | "history";
  loading: boolean;
  refreshing: boolean;
  searchQuery: string;
  mobileSidebarOpen: boolean;
  onSelectSession: (session: AdvisorySession) => void;
  onActiveViewChange: (view: "live" | "history") => void;
  onRefresh: () => void;
  onSearchChange: (query: string) => void;
  onShowLaunchModal: () => void;
  onMobileSidebarClose: () => void;
}

export default function SessionSidebar({
  sessions,
  activeSession,
  activeView,
  loading,
  refreshing,
  searchQuery,
  mobileSidebarOpen,
  onSelectSession,
  onActiveViewChange,
  onRefresh,
  onSearchChange,
  onShowLaunchModal,
  onMobileSidebarClose,
}: SessionSidebarProps) {
  const visibleSessions = sessions.filter((s) => !s.archived);
  const liveSessions = visibleSessions.filter((s) => s.status === "active");
  const completedSessions = visibleSessions.filter((s) => s.status !== "active");

  return (
    <div
      className={`advisory-sidebar${mobileSidebarOpen ? "" : " closed"}`}
      style={{
        width: "280px",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--border)",
        backgroundColor: "var(--surface)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={18} color="var(--accent)" />
            <h1 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-heading)" }}>
              Advisory Board
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button
              onClick={onRefresh}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "6px" }}
              title="Refresh"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
            <button
              className="advisory-mobile-menu-btn"
              onClick={onMobileSidebarClose}
              style={{
                background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)",
                padding: "6px", alignItems: "center", justifyContent: "center", display: "none",
              }}
              aria-label="Close sidebar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <button
          onClick={onShowLaunchModal}
          style={{
            width: "100%", padding: "9px", borderRadius: "8px", border: "none",
            backgroundColor: "var(--accent)", color: "#fff", cursor: "pointer",
            fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center",
            justifyContent: "center", gap: "6px", fontFamily: "var(--font-heading)",
          }}
        >
          <MessageSquarePlus size={14} />
          New Session
        </button>
        <Link
          href="/advisory/settings"
          style={{
            width: "100%", padding: "7px", borderRadius: "8px",
            border: "1px solid var(--border)",
            backgroundColor: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer", fontSize: "11px", fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            fontFamily: "var(--font-body)", marginTop: "6px", transition: "all 150ms ease",
            textDecoration: "none",
          }}
        >
          <Settings size={13} />
          Model Connections
        </Link>
      </div>

      {/* View Toggle */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "8px 12px", gap: "4px" }}>
        {[
          { id: "live", label: "Live", icon: Radio, count: liveSessions.length },
          { id: "history", label: "History", icon: History, count: completedSessions.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onActiveViewChange(tab.id as "live" | "history")}
              style={{
                flex: 1, padding: "6px 8px", borderRadius: "6px",
                border: `1px solid ${active ? "var(--accent)" : "transparent"}`,
                backgroundColor: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-muted)",
                cursor: "pointer", fontSize: "11px", fontWeight: 600,
                display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                fontFamily: "var(--font-body)", transition: "all 150ms ease",
              }}
            >
              <Icon size={11} />
              {tab.label}
              <span
                style={{
                  fontSize: "9px", padding: "1px 5px", borderRadius: "9px",
                  backgroundColor: active ? "var(--accent)" : "var(--border)",
                  color: active ? "#fff" : "var(--text-muted)",
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search bar */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ position: "relative" }}>
          <Search
            size={12}
            style={{
              position: "absolute", left: "9px", top: "50%",
              transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none",
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search topics..."
            style={{
              width: "100%", padding: "6px 8px 6px 26px",
              backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)",
              borderRadius: "6px", color: "var(--text-primary)", fontSize: "11px",
              fontFamily: "var(--font-body)", outline: "none", boxSizing: "border-box",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              style={{
                position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)",
                padding: "2px", display: "flex", alignItems: "center",
              }}
            >
              <X size={10} />
            </button>
          )}
        </div>

      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "32px 0", color: "var(--text-muted)" }}>
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : (() => {
          const baseSessions = activeView === "live" ? liveSessions : completedSessions;
          const displaySessions = baseSessions.filter((s) => {
            const matchesSearch = !searchQuery || s.topic.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch;
          });
          if (displaySessions.length === 0) {
            return (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-muted)" }}>
                {searchQuery ? (
                  <>
                    <Search size={20} style={{ opacity: 0.4, margin: "0 auto 8px" }} />
                    <div style={{ fontSize: "12px", marginBottom: "4px" }}>No matching sessions</div>
                    <button
                      onClick={() => onSearchChange("")}
                      style={{
                        marginTop: "8px", fontSize: "10px", color: "var(--accent)",
                        background: "none", border: "none", cursor: "pointer", fontWeight: 600,
                      }}
                    >
                      Clear filters
                    </button>
                  </>
                ) : activeView === "live" ? (
                  <>
                    <Radio size={24} style={{ opacity: 0.4, margin: "0 auto 8px" }} />
                    <div style={{ fontSize: "12px", marginBottom: "4px" }}>No active sessions</div>
                    <div style={{ fontSize: "11px", opacity: 0.6 }}>Launch one to get started</div>
                  </>
                ) : (
                  <>
                    <History size={24} style={{ opacity: 0.4, margin: "0 auto 8px" }} />
                    <div style={{ fontSize: "12px" }}>No past sessions yet</div>
                  </>
                )}
              </div>
            );
          }
          return displaySessions.map((s, idx) => (
            <SessionListItem
              key={`${s.id}-${idx}`}
              session={s}
              active={activeSession?.id === s.id}
              onClick={() => onSelectSession(s)}
            />
          ));
        })()}
      </div>
    </div>
  );
}
