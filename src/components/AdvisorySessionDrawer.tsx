"use client";

import { useEffect, useState } from "react";
import {
  X,
  ExternalLink,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import type { AdvisorySession, AdvisoryEvent, SessionInsights } from "@/types/advisory";

interface AdvisorySessionDrawerProps {
  sessionId: string;
  onClose: () => void;
}

const AGENT_EMOJIS: Record<string, string> = {
  Henry: "⚡",
  Atlas: "📈",
  Nimbus: "🌤️",
  Cipher: "₿",
  Quant: "📊",
  Forge: "🔧",
  Pixel: "💻",
  Scout: "🔭",
  Quill: "✍️",
  Counsel: "⚖️",
};

function formatDateFull(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function EventItem({ event }: { event: AdvisoryEvent }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = event.text.length > 300;
  const preview = isLong && !expanded ? event.text.slice(0, 300) + "…" : event.text;

  return (
    <div
      className="px-4 py-3"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">{event.emoji}</span>
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          {event.speaker}
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ backgroundColor: "var(--card-elevated)", color: "var(--text-muted)" }}
        >
          {event.type}
        </span>
        <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
          {new Date(event.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <p
        className="text-xs whitespace-pre-wrap"
        style={{ color: "var(--text-secondary)", lineHeight: "1.5" }}
      >
        {preview}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs mt-1"
          style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function InsightsSection({ insights }: { insights: SessionInsights }) {
  return (
    <div className="px-4 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
      <h3
        className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2"
        style={{ color: "var(--text-muted)" }}
      >
        <Lightbulb className="w-3.5 h-3.5" />
        Insights
      </h3>

      {insights.keyDecisions.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-semibold mb-1.5" style={{ color: "#60a5fa" }}>
            Key Decisions
          </div>
          <ul className="space-y-1">
            {insights.keyDecisions.map((d, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: "#60a5fa" }} />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {insights.actionItems.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-semibold mb-1.5" style={{ color: "#4ade80" }}>
            Action Items
          </div>
          <ul className="space-y-1">
            {insights.actionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span
                  className="text-xs px-1 py-0.5 rounded flex-shrink-0"
                  style={{
                    backgroundColor: item.priority === "high" ? "#ef444420" : item.priority === "medium" ? "#f59e0b20" : "#6b728020",
                    color: item.priority === "high" ? "#ef4444" : item.priority === "medium" ? "#f59e0b" : "#6b7280",
                  }}
                >
                  {item.priority}
                </span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {item.description}
                  {item.assignedAgent && (
                    <span style={{ color: "var(--text-muted)" }}> — {item.assignedAgent}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {insights.risksIdentified.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-semibold mb-1.5" style={{ color: "#f97316" }}>
            Risks
          </div>
          <ul className="space-y-1">
            {insights.risksIdentified.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: "#f97316" }} />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {insights.openQuestions.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-1.5" style={{ color: "#a78bfa" }}>
            Open Questions
          </div>
          <ul className="space-y-1">
            {insights.openQuestions.map((q, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>?</span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AdvisorySessionDrawer({ sessionId, onClose }: AdvisorySessionDrawerProps) {
  const [session, setSession] = useState<AdvisorySession | null>(null);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const loading = loadedSessionId !== sessionId;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/advisory/sessions/${sessionId}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setSession(data.session || null);
        setLoadedSessionId(sessionId);
      })
      .catch(() => {
        if (cancelled) return;
        setSession(null);
        setLoadedSessionId(sessionId);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const statusColor =
    session?.status === "active" ? "#4ade80" :
    session?.status === "completed" ? "#60a5fa" :
    "#6b7280";

  const statusLabel =
    session?.status === "active" ? "Active" :
    session?.status === "completed" ? "Completed" :
    session?.status || "Unknown";

  const events = session?.events || [];
  const displayedEvents = showAllEvents ? events : events.slice(0, 5);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50"
        style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: "min(640px, 100vw)",
          backgroundColor: "var(--card)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: "var(--accent)" }} />
            <span
              className="text-sm font-semibold"
              style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}
            >
              Advisory Session
            </span>
            {session && (
              <span
                className="text-xs px-2 py-0.5 rounded font-medium"
                style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
              >
                {statusLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {session && (
              <Link
                href={`/advisory?session=${session.id}`}
                className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-opacity hover:opacity-80"
                style={{ backgroundColor: "var(--card-elevated)", color: "var(--accent)", border: "1px solid var(--border)" }}
              >
                <ExternalLink className="w-3 h-3" />
                Open
              </Link>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded transition-opacity hover:opacity-70"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading session…</div>
            </div>
          ) : !session ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>Session not found</div>
            </div>
          ) : (
            <>
              {/* Topic */}
              <div className="px-4 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Topic
                </div>
                <p className="text-sm" style={{ color: "var(--text-primary)", lineHeight: "1.5" }}>
                  {session.topic}
                </p>
              </div>

              {/* Meta */}
              <div
                className="px-4 py-3 grid grid-cols-2 gap-3"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>Mode</div>
                  <div className="text-sm font-medium capitalize mt-0.5" style={{ color: "var(--text-primary)" }}>
                    {session.mode}
                  </div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>Model</div>
                  <div className="text-sm font-medium mt-0.5" style={{ color: "var(--text-primary)" }}>
                    {session.model ? session.model.split("/").pop() : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                    <Clock className="w-3 h-3" /> Created
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {formatDateFull(session.createdAt)}
                  </div>
                </div>
                {session.completedAt && (
                  <div>
                    <div className="text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                      <CheckCircle2 className="w-3 h-3" /> Completed
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {formatDateFull(session.completedAt)} · {timeAgo(session.completedAt)}
                    </div>
                  </div>
                )}
              </div>

              {/* Agents */}
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Participants
                </div>
                <div className="flex flex-wrap gap-2">
                  {session.agents.map((agent) => (
                    <span
                      key={agent}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                      style={{ backgroundColor: "var(--card-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                    >
                      {AGENT_EMOJIS[agent] || "🤖"} {agent}
                    </span>
                  ))}
                </div>
              </div>

              {/* Insights */}
              {session.insights && (
                <InsightsSection insights={session.insights} />
              )}

              {/* Events */}
              {events.length > 0 && (
                <div>
                  <div
                    className="px-4 py-3 flex items-center justify-between"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <h3
                      className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Transcript ({events.length} events)
                    </h3>
                  </div>
                  {displayedEvents.map((event) => (
                    <EventItem key={event.id} event={event} />
                  ))}
                  {events.length > 5 && (
                    <div className="px-4 py-3 text-center">
                      <button
                        onClick={() => setShowAllEvents(!showAllEvents)}
                        className="text-xs font-medium"
                        style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
                      >
                        {showAllEvents ? `Show less` : `Show all ${events.length} events`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
