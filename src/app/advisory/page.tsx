"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Users,
  Plus,
  Send,
  CheckCircle2,
  Loader2,
  Copy,
  Download,
  Archive,
  Pause,
  Play,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  FileDown,
  Focus,
  Paperclip,
  GitBranch,
  Settings,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { exportSessionAsPDF } from "@/components/AdvisoryPDFExport";
import { AvatarStack } from "@/components/AgentAvatar";
import type {
  AdvisoryEvent,
  AdvisorySession,
  SessionInsights,
  CustomAgent,
  DetailedActionItem,
} from "@/types/advisory";
import {
  formatDate,
  formatMarkdownExport,
  formatMarkdownFileExport,
  slugify,
  getStatusBadge,
  MODELS,
} from "@/components/advisory/constants";

// Short display labels for models shown as badges
const MODEL_SHORT: Record<string, string> = Object.fromEntries(
  MODELS.map((m) => [m.id, m.label.replace(/ \(.*\)$/, "")])
);

// ─── Component imports ────���───────────────────────��──────────────────────────
import EventBubble from "@/components/advisory/EventBubble";
import TypingIndicator from "@/components/advisory/TypingIndicator";
import SessionSidebar from "@/components/advisory/SessionSidebar";
import SessionInsightsPanel from "@/components/advisory/SessionInsightsPanel";
import ActionItemsPanel from "@/components/advisory/ActionItemsPanel";
import LaunchWizard from "@/components/advisory/LaunchWizard";
import SessionComparison from "@/components/advisory/SessionComparison";
import DeepDiveModal from "@/components/advisory/DeepDiveModal";

// ─── CSS ─────────────────────────────────────────────────────────────────────
import "@/styles/advisory.css";

type FormalArtifactManifestItem = {
  id: string;
  label: string;
  kind: string;
  relativePath: string;
  exists: boolean;
  required: boolean;
  canonical: boolean;
};

type FormalArtifactManifest = {
  status: "completed-valid" | "completed-invalid" | "incomplete" | "unavailable";
  sourcePacketHash?: string;
  items: FormalArtifactManifestItem[];
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AdvisoryPage() {
  // ── Core session state ────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<AdvisorySession[]>([]);
  const [activeSession, setActiveSession] = useState<AdvisorySession | null>(null);
  const activeSessionRef = useRef<AdvisorySession | null>(null);
  const eventsRef = useRef<AdvisoryEvent[]>([]);

  // Keep activeSessionRef in sync (no more localStorage persistence — causes contamination)
  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);
  const [events, setEvents] = useState<AdvisoryEvent[]>([]);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [humanMessage, setHumanMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState<"live" | "history">("live");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const autoPlayTriggeredRef = useRef(false);
  const [togglingPause, setTogglingPause] = useState(false);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const [endSessionConfirm, setEndSessionConfirm] = useState(false);
  const [dismissSessionConfirm, setDismissSessionConfirm] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [advancingTurn, setAdvancingTurn] = useState(false);
  const [requestingFullRound, setRequestingFullRound] = useState(false);
  const [thinkingAgent, setThinkingAgent] = useState<string | null>(null);
  const [thinkingStartedAt, setThinkingStartedAt] = useState<number | null>(null);
  const [thinkingKey, setThinkingKey] = useState<string | null>(null);
  const [connectingToAI, setConnectingToAI] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAgent, setFilterAgent] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [customAgents, setCustomAgents] = useState<CustomAgent[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelections, setCompareSelections] = useState<string[]>([]);
  const [showCompareView, setShowCompareView] = useState(false);
  const [compareSessions, setCompareSessions] = useState<[AdvisorySession | null, AdvisorySession | null]>([null, null]);
  const [sessionInsights, setSessionInsights] = useState<SessionInsights | null>(null);
  const [extractingInsights, setExtractingInsights] = useState(false);
  const [actionItems, setActionItems] = useState<DetailedActionItem[]>([]);
  const [extractingActions, setExtractingActions] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [forking, setForking] = useState(false);
  const [deepDiveAgent, setDeepDiveAgent] = useState<{ id: string; name: string; emoji: string; role: string } | null>(null);
  const [formalArtifactManifest, setFormalArtifactManifest] = useState<FormalArtifactManifest | null>(null);
  const [resumingFormalReview, setResumingFormalReview] = useState(false);

  const eventsEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const humanInputRef = useRef<HTMLTextAreaElement>(null);

  // ── Scroll helpers ────────────────────────────────────────────────────────

  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollTop + el.clientHeight >= el.scrollHeight - 100;
  }, []);

  const sexyScrollTo = useCallback((el: HTMLElement, target: number) => {
    const start = el.scrollTop;
    const distance = target - start;
    if (Math.abs(distance) <= 2) return;
    const duration = Math.min(600, Math.max(300, Math.abs(distance) * 0.5));
    let startTime: number | null = null;

    const easeOutBounce = (t: number): number => {
      if (t < 0.85) {
        const p = t / 0.85;
        return 1 - Math.pow(1 - p, 3);
      } else {
        const p = (t - 0.85) / 0.15;
        const bounce = Math.sin(p * Math.PI) * 0.012;
        return 1 + bounce;
      }
    };

    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      el.scrollTop = start + distance * easeOutBounce(progress);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const target = el.scrollHeight - el.clientHeight;
    if (!smooth) { el.scrollTo({ top: target, behavior: "instant" }); return; }
    sexyScrollTo(el, target);
  }, [sexyScrollTo]);

  // Scroll to the TOP of the latest message (not the bottom of the page)
  const scrollToLatestMessage = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    // Find the last event bubble element
    const bubbles = el.querySelectorAll("[data-event-id]");
    if (bubbles.length === 0) { scrollToBottom(true); return; }
    const lastBubble = bubbles[bubbles.length - 1] as HTMLElement;
    // Target: top of the last message, with a small offset so it's not flush against the edge
    const target = lastBubble.offsetTop - 20;
    sexyScrollTo(el, Math.max(0, target));
  }, [sexyScrollTo, scrollToBottom]);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/advisory/sessions");
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (e) {
      console.error("Failed to load sessions:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSessionEvents = useCallback(async (id: string, preserveEvents = false) => {
    try {
      const res = await fetch(`/api/advisory/sessions/${id}`);
      const data = await res.json();
      if (data.session) {
        setActiveSession(data.session);
        setIsPaused(data.session.paused ?? false);
        if (!preserveEvents || (data.session.events?.length ?? 0) > 0) {
          setEvents(data.session.events || []);
        }
        // Restore thinking/generating state if an agent is mid-response
        if (data.session.thinkingAgent) {
          setThinkingAgent(data.session.thinkingAgent);
          setIsGenerating(true);
          setConnectingToAI(false);
        } else if (data.session.runInProgress) {
          setThinkingAgent(null);
          setIsGenerating(true);
          setConnectingToAI(true);
        } else {
          setThinkingAgent(null);
          setIsGenerating(false);
          setConnectingToAI(false);
        }
      }
    } catch (e) {
      console.error("Failed to load session:", e);
    }
  }, []);

  const loadFormalArtifactManifest = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/advisory/sessions/${id}/formal-artifacts`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.manifest) {
        setFormalArtifactManifest(data.manifest);
      } else {
        setFormalArtifactManifest(null);
      }
    } catch (e) {
      console.error("Failed to load formal artifacts:", e);
      setFormalArtifactManifest(null);
    }
  }, []);

  useEffect(() => {
    if (activeSession?.mode === "formal-board") {
      void loadFormalArtifactManifest(activeSession.id);
    } else {
      setFormalArtifactManifest(null);
    }
  }, [activeSession?.id, activeSession?.mode, activeSession?.status, activeSession?.formalBoard?.phase, loadFormalArtifactManifest]);

  const loadCustomAgents = useCallback(async () => {
    try {
      const stored = localStorage.getItem("advisory-custom-agents");
      setCustomAgents(stored ? JSON.parse(stored) : []);
    } catch (e) {
      console.error("Failed to load custom agents:", e);
      setCustomAgents([]);
    }
  }, []);

  // On mount: load sessions, then auto-select any active session (replaces localStorage restoration)
  useEffect(() => {
    (async () => {
      await loadSessions();
      await loadCustomAgents();
    })();
  }, [loadSessions, loadCustomAgents]);

  // Once sessions load, auto-select the active one (if any) — eliminates stale-ID contamination
  useEffect(() => {
    if (sessions.length > 0 && !activeSession) {
      const active = sessions.find((s) => s.status === "active");
      if (active) {
        loadSessionEvents(active.id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  useEffect(() => {
    if (!activeSession) return;
    const stillVisible = sessions.some((s) => s.id === activeSession.id);
    const hiddenFromLiveView = activeView === "live" && activeSession.status !== "active";

    if (hiddenFromLiveView) {
      setActiveView("history");
      return;
    }

    if (!stillVisible || activeSession.archived) {
      setActiveSession(null);
      setEvents([]);
      setSessionInsights(null);
      setActionItems([]);
    }
  }, [activeSession, activeView, sessions]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (events.length === 0) return;
    // If we're waiting for an agent response (isGenerating) or near bottom, always auto-scroll
    if (isGenerating || isNearBottom()) {
      // Scroll to the TOP of the latest message, not the bottom of the page
      // Longer delay for auto-play (DOM needs time to render) vs manual
      const delay = autoPlay ? 200 : 50;
      setTimeout(() => scrollToLatestMessage(), delay);
      setShowNewMessages(false);
    } else {
      setShowNewMessages(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Keep eventsRef in sync
  useEffect(() => { eventsRef.current = events; }, [events]);

  useEffect(() => {
    const activeThinkingKey = endingSession
      ? `ending:${activeSession?.id ?? "unknown"}`
      : thinkingAgent
        ? `agent:${thinkingAgent}`
        : connectingToAI
          ? `connecting:${activeSession?.id ?? "unknown"}`
          : null;

    if (!activeThinkingKey) {
      setThinkingKey(null);
      setThinkingStartedAt(null);
      return;
    }

    if (activeThinkingKey !== thinkingKey) {
      setThinkingKey(activeThinkingKey);
      setThinkingStartedAt(Date.now());
    }
  }, [activeSession?.id, connectingToAI, endingSession, thinkingAgent, thinkingKey]);

  // ── Polling ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    if (activeSession?.status === "active") {
      pollingRef.current = setInterval(async () => {
        try {
          const currentEvents = eventsRef.current;
          const lastId = currentEvents.length > 0 ? currentEvents[currentEvents.length - 1].id : undefined;
          const url = lastId
            ? `/api/advisory/sessions/${activeSession.id}/events?after=${lastId}`
            : `/api/advisory/sessions/${activeSession.id}/events`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.events && data.events.length > 0) {
            setEvents((prev) => {
              const merged = [...prev];
              for (const event of data.events as AdvisoryEvent[]) {
                const existingIndex = merged.findIndex((item) => item.id === event.id);
                if (existingIndex >= 0) {
                  merged[existingIndex] = { ...merged[existingIndex], ...event };
                } else {
                  merged.push(event);
                }
              }
              return merged;
            });
            setIsGenerating(true);
          }
          if (typeof data.paused === "boolean") {
            setIsPaused(data.paused);
            if (!data.thinkingAgent) {
              if (data.runInProgress && data.status === "active" && !data.paused) {
                setIsGenerating(true);
                setConnectingToAI(true);
              } else {
                setIsGenerating(false);
                setConnectingToAI(false);
              }
            }
          }
          // AUTO-PLAY: trigger next agent when session is idle (no one thinking) and we have events
          // Uses a ref guard to prevent multiple triggers from rapid polling cycles
          if (!data.thinkingAgent && autoPlay && activeSession?.status === "active" && !autoPlayTriggeredRef.current) {
            const currentEvents = eventsRef.current;
            const hasAgentEvents = currentEvents.some(
              (e) => e.speaker !== "the user" && e.speaker !== "System" && e.type !== "start" && e.type !== "complete"
            );
            if (hasAgentEvents) {
              autoPlayTriggeredRef.current = true;
              setTimeout(() => {
                handleNextTurn();
                // Reset the guard after a delay to allow the next cycle
                setTimeout(() => { autoPlayTriggeredRef.current = false; }, 3000);
              }, 1500);
            }
          }
          // Reset guard when an agent starts thinking (new cycle begins)
          if (data.thinkingAgent) {
            autoPlayTriggeredRef.current = false;
          }
          setThinkingAgent(data.thinkingAgent ?? null);
          // Clear connecting state once we know which agent is thinking
          if (data.thinkingAgent) setConnectingToAI(false);
          // Also clear if new events arrived (agent responded)
          if (data.events && data.events.length > 0) setConnectingToAI(false);
          if (data.title) {
            setActiveSession((s) => s && !s.title ? { ...s, title: data.title } : s);
          }
          if (data.status && data.status !== "active") {
            setIsGenerating(false);
            setThinkingAgent(null);
            setConnectingToAI(false);
            setIsPaused(false);
            // Update the active session status so UI reflects completion
            setActiveSession((s) => s ? { ...s, status: data.status, completedAt: data.completedAt || new Date().toISOString() } : s);
            // Update the sessions list so sidebar shows DONE badge
            setSessions((prev) => prev.map((s) => s.id === activeSession.id ? { ...s, status: data.status } : s));
            // DON'T clear localStorage here — keep the session visible until user navigates away
            // localStorage is only cleared when user starts a NEW session or explicitly leaves
            // Reload session data but KEEP the active session selected
            await loadSessionEvents(activeSession.id);
          }
        } catch (e) {
          console.error("Polling error:", e);
        }
      }, 2000);
    } else {
      setIsGenerating(false);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  // NOTE: intentionally excluding `events` from deps to prevent polling restart on every new event
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id, activeSession?.status, loadSessions, loadSessionEvents, autoPlay]);

  // ── Session handlers ──────────────────────────────────────────────────────

  const handleSelectSession = async (session: AdvisorySession) => {
    setEvents([]);
    setShowNewMessages(false);
    setEndSessionConfirm(false);
    setDismissSessionConfirm(false);
    setSessionInsights(null);
    setActionItems([]);
    setMobileSidebarOpen(false);
    await loadSessionEvents(session.id);
    try {
      const res = await fetch(`/api/advisory/sessions/${session.id}/insights`);
      const data = await res.json();
      if (data.insights) setSessionInsights(data.insights);
    } catch { /* ignore */ }
  };

  const handleActiveViewChange = useCallback((view: "live" | "history") => {
    setActiveView(view);
    const matchesView = (session: AdvisorySession) =>
      view === "live" ? session.status === "active" : session.status !== "active";
    const currentMatchesView = activeSession && !activeSession.archived && matchesView(activeSession);
    const nextSession = currentMatchesView
      ? activeSession
      : sessions.find((session) => !session.archived && matchesView(session));

    if (!nextSession) {
      setActiveSession(null);
      setEvents([]);
      setSessionInsights(null);
      setActionItems([]);
      return;
    }

    if (nextSession.id !== activeSession?.id) {
      setEvents([]);
      setShowNewMessages(false);
      setEndSessionConfirm(false);
      setDismissSessionConfirm(false);
      setSessionInsights(null);
      setActionItems([]);
      void loadSessionEvents(nextSession.id);
    }
  }, [activeSession, loadSessionEvents, sessions]);

  const handleLaunch = async (session: AdvisorySession) => {
    setShowLaunchModal(false);
    setMobileSidebarOpen(false);
    setIsGenerating(true);
    await loadSessions();
    await handleSelectSession(session);
    setActiveView("live");
    // Auto-start Round 1 so the user doesn't need to hit Resume first
    setConnectingToAI(true);
    setIsPaused(false);
    const sd = session as unknown as Record<string, unknown>;
    const fireFirstAgent = async (attempt = 1): Promise<void> => {
      try {
        if (sd.pacing === "manual") {
          const res = await fetch(`/api/advisory/sessions/${session.id}/next-agent`, { method: "POST" });
          const data = await res.json();
          if (!res.ok && attempt < 3) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
            return fireFirstAgent(attempt + 1);
          }
          setIsGenerating(true);
          if (data.nextAgent) {
            setThinkingAgent(data.nextAgent);
            setConnectingToAI(false);
          }
        } else {
          const res = await fetch(`/api/advisory/sessions/${session.id}/full-round`, { method: "POST" });
          if (!res.ok && attempt < 3) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
            return fireFirstAgent(attempt + 1);
          }
          setIsGenerating(true);
        }
      } catch (e) {
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          return fireFirstAgent(attempt + 1);
        }
        console.error("Auto-start round 1 error after retries:", e);
      }
    };
    await new Promise((r) => setTimeout(r, 500));
    await fireFirstAgent();
  };

  const handleSendMessage = async () => {
    if (!humanMessage.trim() || !activeSession) return;
    setSendingMessage(true);
    setConnectingToAI(true);
    try {
      const res = await fetch(`/api/advisory/sessions/${activeSession.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: humanMessage }),
      });
      const data = await res.json();
      if (data.event) {
        setEvents((prev) => [...prev, data.event]);
        setHumanMessage("");
      }
    } catch (e) {
      console.error("Failed to send message:", e);
    } finally {
      setSendingMessage(false);
    }
  };

  // ── Session controls ──────────────────────────────────────────────────────

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    if (activeSession) await loadSessionEvents(activeSession.id);
    setRefreshing(false);
  };

  const handleCopyToClipboard = async () => {
    if (!activeSession) return;
    const markdown = formatMarkdownExport(activeSession, events);
    try {
      await navigator.clipboard.writeText(markdown);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
    } catch (e) {
      console.error("Clipboard error:", e);
    }
  };

  const handleExportMarkdown = () => {
    if (!activeSession) return;
    const markdown = formatMarkdownExport(activeSession, events);
    const dateStr = new Date(activeSession.createdAt).toISOString().split("T")[0];
    const topicSlug = slugify(activeSession.topic);
    const fileName = `advisory-${dateStr}-${topicSlug}.txt`;
    const blob = new Blob([markdown], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMD = () => {
    if (!activeSession) return;
    const md = formatMarkdownFileExport(activeSession, events);
    const dateStr = new Date(activeSession.createdAt).toISOString().split("T")[0];
    const topicSlug = slugify(activeSession.topic);
    const fileName = `${topicSlug}-${dateStr}.md`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportBriefMD = async () => {
    if (!activeSession) return;
    const res = await fetch(`/api/advisory/sessions/${activeSession.id}/brief?regenerate=1`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.brief?.markdown) {
      console.error("Brief export error:", data);
      return;
    }
    const dateStr = new Date(activeSession.createdAt).toISOString().split("T")[0];
    const topicSlug = slugify(activeSession.title || activeSession.topic);
    const fileName = `${topicSlug}-board-brief-${dateStr}.md`;
    const blob = new Blob([data.brief.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formalArtifactUrl = (artifactId: string, download = false) => {
    if (!activeSession) return "#";
    const params = new URLSearchParams({ artifact: artifactId });
    if (download) params.set("download", "1");
    return `/api/advisory/sessions/${activeSession.id}/formal-artifacts?${params.toString()}`;
  };

  const openFormalArtifact = (artifactId: string, download = false) => {
    if (!activeSession) return;
    const url = formalArtifactUrl(artifactId, download);
    if (download) {
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      a.click();
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleResumeFormalReview = async () => {
    if (!activeSession || resumingFormalReview) return;
    setResumingFormalReview(true);
    try {
      const res = await fetch(`/api/advisory/sessions/${activeSession.id}/resume`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      await loadSessionEvents(activeSession.id, true);
    } catch (e) {
      console.error("Formal resume error:", e);
    } finally {
      setResumingFormalReview(false);
    }
  };

  const handleExportPDF = async () => {
    if (!activeSession || exportingPDF) return;
    setExportingPDF(true);
    try {
      await exportSessionAsPDF(
        activeSession as unknown as import("@/components/AdvisoryPDFExport").PDFSession,
        events as unknown as import("@/components/AdvisoryPDFExport").PDFEvent[]
      );
    } catch (e) {
      console.error("PDF export error:", e);
    } finally {
      setExportingPDF(false);
    }
  };

  const handleArchive = async (dismiss = false) => {
    if (!activeSession) return;
    setArchiving(true);
    try {
      const archiveUrl = dismiss
        ? `/api/advisory/sessions/${activeSession.id}/archive?mode=dismiss`
        : `/api/advisory/sessions/${activeSession.id}/archive`;
      const res = await fetch(archiveUrl, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (dismiss) {
        const dismissedSession = (data.session || { ...activeSession, status: "abandoned", archived: false }) as AdvisorySession;
        setSessions((prev) => prev.map((s) => s.id === activeSession.id ? dismissedSession : s));
        setActiveView("history");
        setActiveSession(dismissedSession);
        setEvents(dismissedSession.events || events);
        setIsGenerating(false);
        setConnectingToAI(false);
        setThinkingAgent(null);
        setIsPaused(true);
      } else {
        setSessions((prev) => prev.filter((s) => s.id !== activeSession.id));
        setActiveSession(null);
        setEvents([]);
        setSessionInsights(null);
        setActionItems([]);
      }
      setEndSessionConfirm(false);
      setDismissSessionConfirm(false);
      await loadSessions();
    } catch (e) {
      console.error("Archive error:", e);
    } finally {
      setArchiving(false);
    }
  };

  const handleTogglePause = async () => {
    if (!activeSession) return;
    setTogglingPause(true);
    try {
      const newPaused = !isPaused;
      await fetch(`/api/advisory/sessions/${activeSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: newPaused }),
      });
      setIsPaused(newPaused);
      setActiveSession((s) => s ? { ...s, paused: newPaused } : s);
      // When resuming, trigger agent responses
      if (!newPaused) {
        setConnectingToAI(true);
        if (sessionData?.pacing === "manual") {
          // Manual pacing: fire one agent at a time
          const res = await fetch(`/api/advisory/sessions/${activeSession.id}/next-agent`, { method: "POST" });
          const data = await res.json();
          setIsGenerating(true);
          if (data.nextAgent) {
            setThinkingAgent(data.nextAgent);
            setConnectingToAI(false);
          }
        } else {
          await fetch(`/api/advisory/sessions/${activeSession.id}/full-round`, { method: "POST" });
          setIsGenerating(true);
        }
      }
    } catch (e) {
      console.error("Pause toggle error:", e);
    } finally {
      setTogglingPause(false);
    }
  };

  const handleNextTurn = async () => {
    if (!activeSession || advancingTurn || isGenerating) return;
    setAdvancingTurn(true);
    setConnectingToAI(true);
    try {
      // For manual pacing: fire one agent at a time via next-agent endpoint
      const res = await fetch(`/api/advisory/sessions/${activeSession.id}/next-agent`, { method: "POST" });
      const data = await res.json();
      if (data.sessionComplete) {
        // Round limit reached — session is ending with synthesis
        setIsGenerating(true);
        setIsPaused(false);
        setConnectingToAI(false);
        setThinkingAgent(activeSession.moderator || activeSession.agents[0] || "Moderator");
        setAutoPlay(false);
        // Add a synthesis placeholder so user sees immediate feedback
        const wrappingEvent: AdvisoryEvent = {
          id: `evt_wrapping_${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "system",
          speaker: "System",
          emoji: "📝",
          role: "system",
          text: "**Session complete!** All rounds finished. The moderator is writing the final synthesis — this takes 15–30 seconds...",
          model: "",
        };
        setEvents((prev) => [...prev, wrappingEvent]);
        setTimeout(() => scrollToBottom(true), 150);
        // The end route is running async — polling will detect completion
        return;
      }
      setIsPaused(false);
      setIsGenerating(true);
      if (data.nextAgent) {
        setThinkingAgent(data.nextAgent);
        setConnectingToAI(false);
      }
      // Auto-scroll to show the "thinking..." indicator so user knows something is happening
      setTimeout(() => scrollToBottom(true), 150); // scroll to bottom for thinking indicator, then scrollToLatestMessage when response arrives
    } catch (e) {
      console.error("Next turn error:", e);
    } finally {
      setAdvancingTurn(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession || endingSession) return;
    setEndingSession(true);
    // Immediately hide the deliberating indicator
    setIsGenerating(false);
    setThinkingAgent(null);
    setConnectingToAI(false);
    try {
      const synthesisPlaceholder: AdvisoryEvent = {
        id: `evt_synth_pending_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "supervisor",
        speaker: "System",
        emoji: "⏳",
        role: "supervisor",
        text: "⏳ **Creating final synthesis artifact...** The moderator is reviewing the full discussion and preparing closing remarks. This may take 15–30 seconds.",
      };
      setEvents((prev) => [...prev, synthesisPlaceholder]);
      setTimeout(() => scrollToBottom(), 100);
      await fetch(`/api/advisory/sessions/${activeSession.id}/end`, { method: "POST" });
      await loadSessionEvents(activeSession.id, true);
      await loadSessions();
      setIsGenerating(true);
    } catch (e) {
      console.error("End session error:", e);
    } finally {
      setEndingSession(false);
      setEndSessionConfirm(false);
    }
  };

  const handleFullRound = async () => {
    if (!activeSession) return;
    setRequestingFullRound(true);
    setConnectingToAI(true);
    try {
      await fetch(`/api/advisory/sessions/${activeSession.id}/full-round`, { method: "POST" });
      setIsGenerating(true);
    } catch (e) {
      console.error("Full round error:", e);
    } finally {
      setRequestingFullRound(false);
    }
  };

  const handleContinueDiscussion = async () => {
    if (!activeSession) return;
    setContinuing(true);
    try {
      await fetch(`/api/advisory/sessions/${activeSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active", completedAt: null, outcome: null, rounds: "persistent", paused: false }),
      });
      setActiveSession((s) => s ? { ...s, status: "active", completedAt: undefined, outcome: undefined } : s);
      setIsGenerating(false);
      await loadSessions();
      await loadSessionEvents(activeSession.id);
    } catch (e) {
      console.error("Continue discussion error:", e);
    } finally {
      setContinuing(false);
    }
  };

  const handleExtractInsights = async () => {
    if (!activeSession) return;
    setExtractingInsights(true);
    setExtractingActions(true);
    try {
      // Extract insights and action items in parallel
      const [insightsRes, actionsRes] = await Promise.all([
        fetch(`/api/advisory/sessions/${activeSession.id}/insights`, { method: "POST" }),
        fetch(`/api/advisory/sessions/${activeSession.id}/actions`, { method: "POST" }),
      ]);
      const insightsData = await insightsRes.json();
      if (insightsData.insights) setSessionInsights(insightsData.insights);
      const actionsData = await actionsRes.json();
      if (actionsData.actions) setActionItems(actionsData.actions);
    } catch (e) {
      console.error("Insights extraction error:", e);
    } finally {
      setExtractingInsights(false);
      setExtractingActions(false);
    }
  };

  const handlePushActionToTask = async (action: DetailedActionItem, mode: "now" | "schedule") => {
    try {
      const priorityMap: Record<string, string> = { high: "P1", medium: "P2", low: "P3" };
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: action.title,
          description: action.description,
          status: mode === "now" ? "in-progress" : "backlog",
          priority: priorityMap[action.priority] || "P2",
          assignee: action.assignedAgent,
          project: "advisory-board",
          type: "feature" as const,
          tags: ["from-advisory", activeSession?.topic || ""].filter(Boolean),
          source_url: activeSession ? `/advisory?session=${activeSession.id}` : undefined,
          notes: action.source + (action.suggestedDeadline !== "none" ? ` | Deadline: ${action.suggestedDeadline}` : ""),
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      // Update local state
      setActionItems((prev) =>
        prev.map((a) => (a.id === action.id ? { ...a, status: "pushed" as const } : a))
      );
    } catch (e) {
      console.error("Push action to task error:", e);
    }
  };

  const handleSkipAction = (actionId: string) => {
    setActionItems((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, status: "skipped" as const } : a))
    );
  };

  const handleToggleActionItem = async (index: number, status: "pending" | "done") => {
    if (!activeSession) return;
    try {
      const res = await fetch(`/api/advisory/sessions/${activeSession.id}/insights`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionIndex: index, status }),
      });
      const data = await res.json();
      if (data.insights) setSessionInsights(data.insights);
    } catch (e) {
      console.error("Toggle action item error:", e);
    }
  };

  const handleRetrySession = async () => {
    if (!activeSession) return;
    try {
      setEvents((prev) => prev.filter((e) => e.type !== "error" && !e.error));
      await fetch(`/api/advisory/sessions/${activeSession.id}/run`, { method: "POST" });
      setIsGenerating(true);
    } catch (e) {
      console.error("Retry error:", e);
    }
  };

  const handleForkFromEvent = async (eventId: string) => {
    if (!activeSession || forking) return;
    setForking(true);
    try {
      const eventIndex = events.findIndex((e) => e.id === eventId);
      if (eventIndex === -1) return;
      const forkedEvents = events.slice(0, eventIndex + 1);
      const sessionData = activeSession as unknown as Record<string, unknown>;
      const res = await fetch("/api/advisory/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: activeSession.topic,
          mode: activeSession.mode,
          agents: activeSession.agents,
          model: activeSession.model,
          rounds: "persistent",
          pacing: sessionData.pacing || "manual",
          responseLength: sessionData.responseLength || "balanced",
          extendedThinking: sessionData.extendedThinking || false,
          personaOverlays: sessionData.personaOverlays || {},
          specialist: sessionData.specialist || false,
          specialistAgent: sessionData.specialistAgent || null,
          forkedFrom: activeSession.id,
          forkedAtEvent: eventId,
        }),
      });
      if (!res.ok) throw new Error("Failed to create forked session");
      const data = await res.json();
      const forkMarkerEvent: AdvisoryEvent = {
        id: `evt_fork_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "start",
        speaker: "System",
        emoji: "🔀",
        role: "supervisor",
        text: `🔀 **Forked session.** This session was branched from "${activeSession.title || activeSession.topic}" at event ${eventIndex + 1} of ${events.length}.\n\nAll prior context has been preserved. Continue the discussion from this point.`,
      };
      const newEvents = [...forkedEvents, forkMarkerEvent];
      await fetch(`/api/advisory/sessions/${data.session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: newEvents,
          forkedFrom: activeSession.id,
          forkedAtEvent: eventId,
        }),
      });
      await loadSessions();
      await handleSelectSession({ ...data.session, events: newEvents });
      setActiveView("live");
    } catch (e) {
      console.error("Fork error:", e);
    } finally {
      setForking(false);
    }
  };

  // ── Deep Dive ─��───────────────────────────────────────────────────────────

  const handleDeepDive = (agentId: string, agentName: string, agentEmoji: string, agentRole: string) => {
    setShowLaunchModal(false);
    setDeepDiveAgent({ id: agentId, name: agentName, emoji: agentEmoji, role: agentRole });
  };

  const handleLaunchDeepDive = async (topic: string, model: string) => {
    if (!deepDiveAgent) return;
    try {
      const res = await fetch("/api/advisory/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          mode: "roundtable",
          agents: [deepDiveAgent.name],
          model,
          rounds: "persistent",
          pacing: "manual",
          responseLength: "detailed",
          specialist: true,
          specialistAgent: deepDiveAgent.name,
        }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const data = await res.json();
      try {
        await fetch(`/api/advisory/sessions/${data.session.id}/run`, { method: "POST" });
      } catch (runErr) {
        console.warn("Run trigger error (non-fatal):", runErr);
      }
      setDeepDiveAgent(null);
      await handleLaunch(data.session);
    } catch (e) {
      console.error("Deep dive launch error:", e);
    }
  };

  // ── Compare sessions ──────────────────────────────────────────────────────

  const handleToggleCompareSelection = (sessionId: string) => {
    setCompareSelections((prev) => {
      if (prev.includes(sessionId)) return prev.filter((s) => s !== sessionId);
      if (prev.length >= 2) return [prev[1], sessionId];
      return [...prev, sessionId];
    });
  };

  const handleOpenCompare = async () => {
    if (compareSelections.length !== 2) return;
    const loaded: [AdvisorySession | null, AdvisorySession | null] = [null, null];
    for (let i = 0; i < 2; i++) {
      try {
        const res = await fetch(`/api/advisory/sessions/${compareSelections[i]}`);
        const data = await res.json();
        loaded[i] = data.session || null;
      } catch { /* ignore */ }
    }
    setCompareSessions(loaded as [AdvisorySession | null, AdvisorySession | null]);
    setShowCompareView(true);
    setCompareMode(false);
    setCompareSelections([]);
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault();
          setShowLaunchModal(true);
        }
      }
      if (e.key === "Escape") {
        if (showCompareView) setShowCompareView(false);
        else if (compareMode) { setCompareMode(false); setCompareSelections([]); }
        else if (showLaunchModal) setShowLaunchModal(false);
        if (endSessionConfirm) setEndSessionConfirm(false);
        if (dismissSessionConfirm) setDismissSessionConfirm(false);
        if (mobileSidebarOpen) setMobileSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLaunchModal, endSessionConfirm, dismissSessionConfirm, mobileSidebarOpen, showCompareView, compareMode]);

  // ── Round tracking ──────────────────────────────────────────────────────
  // Compute which round each event belongs to by tracking agent cycles.
  // A new round starts when we see a non-human, non-system speaker that
  // already appeared in the current round (i.e. the agent list is cycling).

  const roundMap = new Map<string, number>();
  const totalRoundsRef = useRef(1);
  (() => {
    const agentEvents = events.filter(
      (e) => e.speaker !== "the user" && e.speaker !== "System" && e.type !== "start" && e.type !== "complete" && !e.error
    );
    let round = 1;
    const seenInRound = new Set<string>();
    for (const e of agentEvents) {
      if (seenInRound.has(e.speaker)) {
        round++;
        seenInRound.clear();
      }
      seenInRound.add(e.speaker);
      roundMap.set(e.id, round);
    }
    totalRoundsRef.current = round;
    // Also assign rounds to human/system events based on surrounding context
    let lastRound = 1;
    for (const e of events) {
      if (roundMap.has(e.id)) {
        lastRound = roundMap.get(e.id)!;
      } else {
        roundMap.set(e.id, lastRound);
      }
    }
  })();

  // ── Render ────────────────────────────────────────────────────────────────

  const sessionData = activeSession as unknown as Record<string, unknown> | null;
  const formalArtifactStatusLabel = formalArtifactManifest?.status === "completed-valid"
    ? "Formal artifacts ready"
    : formalArtifactManifest?.status === "completed-invalid"
    ? "Invalid formal artifacts"
    : formalArtifactManifest?.status === "incomplete"
    ? "Formal artifacts incomplete"
    : "Formal artifacts unavailable";
  const formalArtifactStatusColor = formalArtifactManifest?.status === "completed-valid"
    ? "#4ade80"
    : formalArtifactManifest?.status === "completed-invalid"
    ? "#facc15"
    : "#a78bfa";
  const formalArtifactActions = formalArtifactManifest?.items
    .filter((item) => [
      "final-consensus-html",
      "verdict",
      "run-metadata",
      "source-packet",
      "handoff-data",
    ].includes(item.id)) || [];
  const formalHasRecoverableStep = Boolean(activeSession?.runSteps?.some((step) =>
    step.phase.startsWith("formal-") && (step.status === "failed" || step.status === "stale")
  ));
  const showFormalResume = Boolean(
    activeSession?.mode === "formal-board" &&
    activeSession.status === "active" &&
    !activeSession.runInProgress &&
    !isGenerating &&
    (formalHasRecoverableStep || activeSession.formalBoard?.phase !== "complete")
  );

  return (
    <>
      {/* Mobile sidebar backdrop */}
      {mobileSidebarOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          style={{
            position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 299, display: "none",
          }}
        />
      )}

      <div
        className="advisory-layout"
        style={{
          display: "flex",
          height: "calc(100dvh - 32px)",
          gap: "0",
          minHeight: 0,
          position: "relative",
          margin: "16px",
          width: "calc(100% - 32px)",
          overflow: "hidden",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          backgroundColor: "var(--background)",
        }}
      >

        {/* ─── LEFT SIDEBAR ──────────────────────────────── */}
        <SessionSidebar
            sessions={sessions}
            activeSession={activeSession}
            activeView={activeView}
            loading={loading}
            refreshing={refreshing}
            searchQuery={searchQuery}
            filterAgent={filterAgent}
            showFilters={showFilters}
            compareMode={compareMode}
            compareSelections={compareSelections}
            mobileSidebarOpen={mobileSidebarOpen}
            onSelectSession={handleSelectSession}
            onActiveViewChange={handleActiveViewChange}
            onRefresh={handleRefresh}
            onSearchChange={setSearchQuery}
            onFilterAgentChange={setFilterAgent}
            onShowFiltersChange={setShowFilters}
            onCompareModeToggle={() => { setCompareMode((v) => !v); setCompareSelections([]); }}
            onCompareToggle={handleToggleCompareSelection}
            onOpenCompare={handleOpenCompare}
            onShowLaunchModal={() => setShowLaunchModal(true)}
            onMobileSidebarClose={() => setMobileSidebarOpen(false)}
          />

        {/* ─── MAIN CONTENT ─────────────────────────────── */}
        {/* FIX: minWidth:0 prevents flex child from overflowing (text wrapping bug) */}
        <div className="advisory-main" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          {/* Mobile top bar */}
          <div
            className="advisory-mobile-menu-btn"
            style={{
              display: "none", alignItems: "center", gap: "10px",
              padding: "10px 16px", borderBottom: "1px solid var(--border)",
              backgroundColor: "var(--surface)", flexShrink: 0,
            }}
          >
            <button
              onClick={() => setMobileSidebarOpen(true)}
              style={{
                background: "none", border: "1px solid var(--border)", cursor: "pointer",
                color: "var(--text-primary)", padding: "6px 10px", borderRadius: "6px",
                display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 600,
              }}
            >
              <Users size={14} />
              Sessions
            </button>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
              Advisory Board
            </span>
            <Link
              href="/advisory/settings"
              style={{
                padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border)",
                color: "var(--text-muted)", display: "flex", alignItems: "center",
                textDecoration: "none",
              }}
              aria-label="Model settings"
            >
              <Settings size={13} />
            </Link>
            <button
              onClick={() => setShowLaunchModal(true)}
              style={{
                marginLeft: "auto", padding: "6px 12px", borderRadius: "6px", border: "none",
                backgroundColor: "var(--accent)", color: "#fff", cursor: "pointer",
                fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px",
              }}
            >
              <Plus size={12} />
              New
            </button>
          </div>

          {activeSession ? (
            <>
              {/* ── Session header (ALWAYS VISIBLE — never scrolls) ── */}
              <div
                className="advisory-session-header"
                style={{
                  padding: "12px 24px",
                  borderBottom: `1px solid ${sessionData?.specialist ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
                  backgroundColor: sessionData?.specialist ? "rgba(16,185,129,0.03)" : "var(--surface)",
                  flexShrink: 0,
                  zIndex: 20,
                  overflow: "hidden",
                }}
              >
                <div className="advisory-session-header-row" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                  <div className="advisory-session-title-block" style={{ flex: "1 1 520px", minWidth: "320px", maxWidth: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                      {(() => {
                        const badge = getStatusBadge(activeSession.status);
                        return (
                          <span style={{
                            fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", color: badge.color,
                            backgroundColor: badge.bg, padding: "2px 8px", borderRadius: "4px",
                            fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: "4px",
                          }}>
                            {activeSession.status === "active" && (
                              <span className="live-dot" style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: badge.color, display: "inline-block" }} />
                            )}
                            {badge.label}
                          </span>
                        );
                      })()}
                      <span style={{
                        fontSize: "9px", fontWeight: 600, color: "var(--text-muted)",
                        backgroundColor: "var(--surface-elevated)", padding: "2px 8px",
                        borderRadius: "4px", fontFamily: "var(--font-mono)", textTransform: "uppercase",
                      }}>
                        {activeSession.mode}
                      </span>
                      {activeSession.mode === "competitive" && (() => {
                        const phase = (sessionData?.competitive as { phase?: string } | undefined)?.phase;
                        const phaseMap: Record<string, { label: string; color: string; bg: string; border: string }> = {
                          pitch: { label: "⚔️ PITCH", color: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)" },
                          critique: { label: "🔥 CRITIQUE", color: "#fb923c", bg: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.3)" },
                          vote: { label: "🗳️ VOTE", color: "#34d399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.3)" },
                          complete: { label: "🏆 DONE", color: "#fbbf24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)" },
                        };
                        const p = phaseMap[phase || "pitch"];
                        if (!p) return null;
                        return (
                          <span style={{ fontSize: "9px", fontWeight: 700, color: p.color, backgroundColor: p.bg, border: `1px solid ${p.border}`, padding: "2px 7px", borderRadius: "4px", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                            {p.label}
                          </span>
                        );
                      })()}
                      {!!sessionData?.specialist && (
                        <span style={{ fontSize: "9px", fontWeight: 700, color: "#10b981", backgroundColor: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", padding: "2px 7px", borderRadius: "4px", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Focus size={9} /> DEEP DIVE
                        </span>
                      )}
                      {sessionData?.rounds === "persistent" && !sessionData?.specialist && (
                        <span style={{ fontSize: "9px", fontWeight: 700, color: "#a78bfa", backgroundColor: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", padding: "2px 7px", borderRadius: "4px", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>∞ PERSISTENT</span>
                      )}
                      {!!sessionData?.forkedFrom && (
                        <span style={{ fontSize: "9px", fontWeight: 700, color: "#60a5fa", backgroundColor: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)", padding: "2px 7px", borderRadius: "4px", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <GitBranch size={9} /> FORKED
                        </span>
                      )}
                      {!!sessionData?.referenceContext && (
                        <span style={{ fontSize: "9px", fontWeight: 700, color: "#a78bfa", backgroundColor: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", padding: "2px 7px", borderRadius: "4px", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Paperclip size={9} /> REF MATERIAL
                        </span>
                      )}
                      {activeSession.model && (
                        <span title={activeSession.model} style={{
                          fontSize: "9px", fontWeight: 700, color: "#818cf8",
                          backgroundColor: "rgba(129,140,248,0.12)", border: "1px solid rgba(129,140,248,0.25)",
                          padding: "2px 7px", borderRadius: "4px", fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                        }}>
                          {MODEL_SHORT[activeSession.model] ?? activeSession.model}
                        </span>
                      )}
                      {typeof sessionData?.rounds === "number" && (
                        <span style={{
                          fontSize: "9px", fontWeight: 700, color: "#fb923c",
                          backgroundColor: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.25)",
                          padding: "2px 7px", borderRadius: "4px", fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                        }}>
                          {sessionData.rounds as number}R
                        </span>
                      )}
                      {typeof sessionData?.responseLength === "string" && (
                        <span style={{
                          fontSize: "9px", fontWeight: 700, color: "#34d399",
                          backgroundColor: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)",
                          padding: "2px 7px", borderRadius: "4px", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", textTransform: "uppercase",
                        }}>
                          {sessionData.responseLength}
                        </span>
                      )}
                    </div>
                    <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-heading)", lineHeight: 1.3, wordBreak: "normal", overflowWrap: "anywhere", whiteSpace: "normal" }}>
                      {activeSession.title ? activeSession.title : activeSession.topic.length > 100 ? `${activeSession.topic.slice(0, 100)}...` : activeSession.topic}
                    </h2>
                    {activeSession.title && (
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px", fontStyle: "italic" }}>
                        {activeSession.topic.length > 80 ? `${activeSession.topic.slice(0, 80)}...` : activeSession.topic}
                      </div>
                    )}
                  </div>

                  <div className="advisory-session-meta" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", flex: "0 1 520px", minWidth: "280px", maxWidth: "100%", flexWrap: "wrap" }}>
                    <AvatarStack agentIds={activeSession.agents} size={28} max={5} />
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "right" }}>
                      <div>{events.length} events</div>
                      <div>{formatDate(activeSession.createdAt)}</div>
                    </div>
                    <div className="advisory-session-actions" style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {activeSession.status === "active" && (
                        <button onClick={handleTogglePause} disabled={togglingPause} title={isPaused ? "Resume session" : "Pause session"}
                          style={{ padding: "6px 10px", borderRadius: "6px", border: `1px solid ${isPaused ? "rgba(74,222,128,0.5)" : "var(--border)"}`, backgroundColor: isPaused ? "rgba(74,222,128,0.12)" : "var(--surface-elevated)", color: isPaused ? "#4ade80" : "var(--text-muted)", cursor: togglingPause ? "not-allowed" : "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", fontWeight: 600, transition: "all 150ms ease", opacity: togglingPause ? 0.6 : 1 }}>
                          {togglingPause ? <Loader2 size={12} className="animate-spin" /> : isPaused ? <Play size={12} /> : <Pause size={12} />}
                          {isPaused ? "Resume" : "Pause"}
                        </button>
                      )}
                      {activeSession.status === "active" && !endSessionConfirm && !dismissSessionConfirm && (
                        <button onClick={() => { setEndSessionConfirm(true); setDismissSessionConfirm(false); }} disabled={endingSession} title="Finish session and create final synthesis"
                          style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(74,222,128,0.35)", backgroundColor: "rgba(74,222,128,0.08)", color: "#4ade80", cursor: endingSession ? "not-allowed" : "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", fontWeight: 600, transition: "all 150ms ease", opacity: endingSession ? 0.5 : 1 }}>
                          <CheckCircle2 size={12} /> Finish
                        </button>
                      )}
                      {activeSession.status === "active" && !endSessionConfirm && !dismissSessionConfirm && (
                        <button onClick={() => { setDismissSessionConfirm(true); setEndSessionConfirm(false); }} disabled={archiving} title="Dismiss active session to History without creating a final synthesis"
                          style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(250,204,21,0.42)", backgroundColor: "rgba(250,204,21,0.08)", color: "#facc15", cursor: archiving ? "not-allowed" : "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", fontWeight: 600, transition: "all 150ms ease", opacity: archiving ? 0.6 : 1 }}>
                          {archiving ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />} Dismiss
                        </button>
                      )}
                      {activeSession.status === "active" && endSessionConfirm && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", borderRadius: "8px", border: "1px solid rgba(74,222,128,0.35)", backgroundColor: "rgba(74,222,128,0.08)" }}>
                          <span style={{ fontSize: "10px", color: "#4ade80", fontWeight: 600, whiteSpace: "nowrap" }}>Create final synthesis artifact →</span>
                          <button onClick={handleEndSession} disabled={endingSession}
                            style={{ padding: "4px 10px", borderRadius: "5px", border: "none", backgroundColor: "#16a34a", color: "#fff", cursor: endingSession ? "not-allowed" : "pointer", fontSize: "10px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px", opacity: endingSession ? 0.7 : 1 }}>
                            {endingSession ? <Loader2 size={10} className="animate-spin" /> : null} Finish
                          </button>
                          <button onClick={() => setEndSessionConfirm(false)}
                            style={{ padding: "4px 8px", borderRadius: "5px", border: "1px solid rgba(74,222,128,0.25)", backgroundColor: "transparent", color: "#4ade80", cursor: "pointer", fontSize: "10px", fontWeight: 600 }}>
                            Cancel
                          </button>
                        </div>
                      )}
                      {activeSession.status === "active" && dismissSessionConfirm && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", borderRadius: "8px", border: "1px solid rgba(250,204,21,0.42)", backgroundColor: "rgba(250,204,21,0.08)", maxWidth: "100%", flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <span style={{ fontSize: "10px", color: "#facc15", fontWeight: 700, maxWidth: "270px", whiteSpace: "normal", lineHeight: 1.25 }}>This will dismiss the session and move it to History. You will not be able to finish.</span>
                          <button onClick={() => handleArchive(true)} disabled={archiving}
                            style={{ padding: "4px 10px", borderRadius: "5px", border: "none", backgroundColor: "#ca8a04", color: "#0b0b0c", cursor: archiving ? "not-allowed" : "pointer", fontSize: "10px", fontWeight: 800, display: "flex", alignItems: "center", gap: "4px", opacity: archiving ? 0.7 : 1 }}>
                            {archiving ? <Loader2 size={10} className="animate-spin" /> : null} Dismiss
                          </button>
                          <button onClick={() => setDismissSessionConfirm(false)}
                            style={{ padding: "4px 8px", borderRadius: "5px", border: "1px solid rgba(250,204,21,0.28)", backgroundColor: "transparent", color: "#facc15", cursor: "pointer", fontSize: "10px", fontWeight: 700 }}>
                            Cancel
                          </button>
                        </div>
                      )}
                      {activeSession.status === "completed" && (
                        <>
                          <button onClick={handleCopyToClipboard} title="Copy as Markdown"
                            style={{ padding: "6px 10px", borderRadius: "6px", border: `1px solid ${copiedToast ? "rgba(74,222,128,0.4)" : "rgba(96,165,250,0.4)"}`, backgroundColor: copiedToast ? "rgba(74,222,128,0.1)" : "rgba(96,165,250,0.1)", color: copiedToast ? "#4ade80" : "#60a5fa", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", transition: "all 150ms ease", fontWeight: 600 }}>
                            <Copy size={12} /> {copiedToast ? "Copied!" : "Copy"}
                          </button>
                          <button onClick={handleExportMarkdown} title="Export as plain text file"
                            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(96,165,250,0.4)", backgroundColor: "rgba(96,165,250,0.1)", color: "#60a5fa", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", fontWeight: 600 }}>
                            <Download size={12} /> Export
                          </button>
                          <button onClick={handleExportMD} title="Export as Markdown file"
                            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(96,165,250,0.4)", backgroundColor: "rgba(96,165,250,0.1)", color: "#60a5fa", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", fontWeight: 600 }}>
                            <FileDown size={12} /> Export MD
                          </button>
                          <button onClick={handleExportBriefMD} title="Export board brief with transcript"
                            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(74,222,128,0.4)", backgroundColor: "rgba(74,222,128,0.1)", color: "#4ade80", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", fontWeight: 700 }}>
                            <FileText size={12} /> Brief MD
                          </button>
                          <Link href={`/brief/${activeSession.id}`} target="_blank" title="Open board brief"
                            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(74,222,128,0.4)", backgroundColor: "rgba(74,222,128,0.08)", color: "#4ade80", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", fontWeight: 700, textDecoration: "none" }}>
                            <FileText size={12} /> Open Brief
                          </Link>
                          <button onClick={handleExportPDF} disabled={exportingPDF} title="Print / Save PDF"
                            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(139,92,246,0.4)", backgroundColor: exportingPDF ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.1)", color: "#a78bfa", cursor: exportingPDF ? "not-allowed" : "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", fontWeight: 600, opacity: exportingPDF ? 0.7 : 1, transition: "all 150ms ease" }}>
                            {exportingPDF ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
                            {exportingPDF ? "Opening..." : "Print / PDF"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Paused banner */}
              {isPaused && activeSession.status === "active" && (
                <div style={{ padding: "8px 24px", backgroundColor: "rgba(251,146,60,0.08)", borderBottom: "1px solid rgba(251,146,60,0.25)", display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <Pause size={12} color="#fb923c" />
                  <span style={{ fontSize: "11px", color: "#fb923c", fontWeight: 600 }}>Session paused — agents are waiting</span>
                </div>
              )}

              {/* Events stream — full width center area */}
              <div style={{ display: "flex", flex: 1, overflow: "hidden", minWidth: 0 }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
                  {/* Competitive phase progress bar */}
                  {activeSession?.status === "active" && activeSession.mode === "competitive" && events.length > 0 && (() => {
                    const phase = (sessionData?.competitive as { phase?: string } | undefined)?.phase || "pitch";
                    const phases = [
                      { id: "pitch", icon: "🎯", label: "Pitch", color: "#a78bfa" },
                      { id: "critique", icon: "🔥", label: "Critique", color: "#fb923c" },
                      { id: "vote", icon: "🗳️", label: "Vote", color: "#34d399" },
                      { id: "complete", icon: "🏆", label: "Done", color: "#fbbf24" },
                    ];
                    const activeIdx = phases.findIndex((p) => p.id === phase);
                    return (
                      <div style={{ padding: "10px 24px", backgroundColor: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0, display: "flex", alignItems: "center", gap: "0" }}>
                        {phases.slice(0, 3).map((p, i) => {
                          const isDone = activeIdx > i;
                          const isCurrent = activeIdx === i;
                          const isLast = i === 2;
                          return (
                            <div key={p.id} style={{ display: "flex", alignItems: "center", flex: isLast ? "0 0 auto" : 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                <span style={{ fontSize: "12px" }}>{p.icon}</span>
                                <span style={{
                                  fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em",
                                  color: isCurrent ? p.color : isDone ? "var(--text-secondary)" : "var(--text-muted)",
                                  fontFamily: "var(--font-mono)",
                                  textDecoration: isDone ? "line-through" : "none",
                                  opacity: isDone ? 0.6 : 1,
                                }}>
                                  {p.label}
                                  {isCurrent && <span style={{ color: p.color, marginLeft: "4px" }}>←</span>}
                                </span>
                              </div>
                              {!isLast && (
                                <div style={{ flex: 1, height: "2px", margin: "0 8px", borderRadius: "1px", backgroundColor: isDone ? "var(--text-muted)" : "var(--border)", opacity: isDone ? 0.4 : 1 }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Persistent round indicator (non-competitive) */}
                  {activeSession?.status === "active" && activeSession.mode !== "competitive" && events.length > 0 && (
                    <div style={{
                      padding: "8px 24px",
                      backgroundColor: "var(--surface)",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      flexShrink: 0,
                      justifyContent: "center",
                      gap: "8px",
                    }}>
                      {(() => {
                        const configuredRounds = activeSession?.rounds && activeSession.rounds !== "persistent" ? Number(activeSession.rounds) : 0;
                        const numAgents = activeSession?.agents?.length || 1;
                        const totalSteps = configuredRounds * numAgents;
                        // Count completed agent responses
                        const agentResponses = events.filter(
                          (e) => e.speaker !== "the user" && e.speaker !== "System" && e.type !== "start" && e.type !== "complete" && !e.error
                        ).length;
                        const progressPct = totalSteps > 0 ? Math.min((agentResponses / totalSteps) * 100, 100) : 0;

                        return (
                          <>
                            <span style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "var(--accent)",
                              letterSpacing: "0.5px",
                            }}>
                              ROUND {totalRoundsRef.current} {configuredRounds ? `OF ${configuredRounds}` : ""}
                            </span>
                            {configuredRounds > 0 && (
                              <div style={{
                                flex: 1,
                                maxWidth: "200px",
                                height: "6px",
                                backgroundColor: "var(--border)",
                                borderRadius: "3px",
                                overflow: "hidden",
                                position: "relative",
                              }}>
                                <div style={{
                                  width: `${progressPct}%`,
                                  height: "100%",
                                  backgroundColor: progressPct >= 100 ? "#22c55e" : "var(--accent)",
                                  borderRadius: "3px",
                                  transition: "width 0.5s ease-out",
                                  boxShadow: progressPct >= 100 ? "0 0 8px #22c55e66" : "0 0 6px var(--accent)44",
                                }} />
                              </div>
                            )}
                            {configuredRounds > 0 && (
                              <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                                {Math.round(progressPct)}% complete
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* FIX: overflowY auto for scrollable events stream */}
                  <div
                    ref={scrollContainerRef}
                    className="advisory-events-stream"
                    style={{ flex: 1, overflowY: "auto", padding: "20px 24px", backgroundColor: "var(--background)", position: "relative" }}
                    onScroll={() => { if (isNearBottom()) setShowNewMessages(false); }}
                  >
                    {events.length === 0 ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", flexDirection: "column", gap: "12px" }}>
                        <Loader2 size={20} className="animate-spin" />
                        <span style={{ fontSize: "12px" }}>Starting conversation...</span>
                      </div>
                    ) : (
                      <>
                        {events.map((event, idx) => {
                          const eventRound = roundMap.get(event.id) ?? 1;
                          const prevRound = idx > 0 ? (roundMap.get(events[idx - 1].id) ?? 1) : 0;
                          const totalRounds = totalRoundsRef.current;
                          // Show divider when entering a new round — including round 1 if multiple rounds exist
                          const isFirstAgentEvent = idx > 0 && event.speaker !== "System" && event.type !== "start";
                          const showRound1 = eventRound === 1 && prevRound === 0 && totalRounds > 1 && isFirstAgentEvent;
                          const showDivider = (eventRound > prevRound && eventRound > 1) || showRound1;
                          return (
                            <div key={event.id} data-event-id={event.id}>
                              {showDivider && (
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "18px 0", opacity: 0.5 }}>
                                  <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border)" }} />
                                  <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                                    Round {eventRound}{(() => {
                                      const configuredRounds = sessionData?.rounds;
                                      const displayTotal = typeof configuredRounds === "number" ? configuredRounds : totalRounds;
                                      return displayTotal > 1 ? ` of ${displayTotal}` : "";
                                    })()}
                                  </span>
                                  <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border)" }} />
                                </div>
                              )}
                              <EventBubble
                                event={event}
                                sessionOverlays={(sessionData?.personaOverlays as Record<string, string> | string[] | undefined) ?? {}}
                                aiPersonas={sessionData?.aiPersonas as Array<{ id: string; name: string; emoji: string; description: string }> | undefined}
                                sessionTopic={activeSession?.topic}
                                sessionMode={activeSession?.mode}
                                customAgentMeta={sessionData?.customAgentMeta as Record<string, { emoji: string; role: string; persona?: string }> | undefined}
                                onRetry={(event.type === "error" || event.error) ? handleRetrySession : undefined}
                                onFork={event.type !== "start" && !event.error ? () => handleForkFromEvent(event.id) : undefined}
                              />
                            </div>
                          );
                        })}
                        {endingSession && activeSession?.status === "active" && (
                          <TypingIndicator agentId={activeSession.moderator || activeSession.agents[0] || "Moderator"} overrideLabel="Moderator is writing the final summary..." startedAt={thinkingStartedAt} />
                        )}
                        {isGenerating && activeSession?.status === "active" && !isPaused && !endingSession && (
                          <TypingIndicator
                            agentId={thinkingAgent}
                            overrideLabel={connectingToAI && !thinkingAgent ? "Connecting to AI..." : undefined}
                            startedAt={thinkingStartedAt}
                          />
                        )}
                        {connectingToAI && !isGenerating && activeSession?.status === "active" && !endingSession && (
                          <TypingIndicator agentId={null} overrideLabel="Connecting to AI..." startedAt={thinkingStartedAt} />
                        )}
                        {activeSession?.status === "completed" && sessionData?.competitive && (sessionData.competitive as { phase: string; votes: unknown[]; winner: string | null; voteTally: Record<string, number> }).winner && (() => {
                          const comp = sessionData.competitive as { phase: string; voteMode?: string; topCount?: number; votes: Array<{ voter: string; votedFor: string; reasoning: string }>; winner: string; voteTally: Record<string, number> };
                          const isTopIdeas = comp.voteMode === "top-ideas";
                          const sortedTally = Object.entries(comp.voteTally).sort(([, a], [, b]) => b - a);
                          return (
                            <div style={{ margin: "16px 0", padding: "20px", borderRadius: "12px", border: "1px solid rgba(251,191,36,0.4)", backgroundColor: "rgba(251,191,36,0.06)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                                <span style={{ fontSize: "22px" }}>🏆</span>
                                <div>
                                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>Competition Results</div>
                                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                    {isTopIdeas ? `Agents voted on the top ${comp.topCount || 3} ideas overall` : "Agents voted on the best idea"}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {sortedTally.map(([name, count]) => {
                                  const rank = sortedTally.findIndex(([candidate]) => candidate === name);
                                  const isWinner = isTopIdeas ? rank >= 0 && rank < (comp.topCount || 3) : name === comp.winner;
                                  return (
                                    <div key={name} style={{
                                      display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px",
                                      borderRadius: "8px",
                                      border: isWinner ? "1px solid rgba(251,191,36,0.5)" : "1px solid var(--border)",
                                      backgroundColor: isWinner ? "rgba(251,191,36,0.1)" : "var(--surface-elevated)",
                                    }}>
                                      <span style={{ fontSize: "14px", fontWeight: 700, color: isWinner ? "#fbbf24" : "var(--text-primary)", minWidth: "80px", fontFamily: "var(--font-heading)" }}>
                                        {name}
                                      </span>
                                      <div style={{ flex: 1, height: "6px", borderRadius: "3px", backgroundColor: "var(--surface)", overflow: "hidden" }}>
                                        <div style={{
                                          width: `${sortedTally.length > 0 ? (count / Math.max(...sortedTally.map(([, v]) => v), 1)) * 100 : 0}%`,
                                          height: "100%", borderRadius: "3px",
                                          backgroundColor: isWinner ? "#fbbf24" : "var(--text-muted)",
                                          transition: "width 0.5s ease",
                                        }} />
                                      </div>
                                      <span style={{ fontSize: "13px", fontWeight: 700, color: isWinner ? "#fbbf24" : "var(--text-secondary)", minWidth: "50px", textAlign: "right" }}>
                                        {count} vote{count !== 1 ? "s" : ""}
                                      </span>
                                      {isWinner && (
                                        <span style={{
                                          fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em",
                                          color: "#fbbf24", backgroundColor: "rgba(251,191,36,0.15)",
                                          border: "1px solid rgba(251,191,36,0.3)", padding: "2px 8px",
                                          borderRadius: "4px", fontFamily: "var(--font-mono)",
                                        }}>
                                          {isTopIdeas ? `TOP ${rank + 1}` : "WINNER"}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              {comp.votes.length > 0 && (
                                <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                                  <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "8px", fontFamily: "var(--font-mono)" }}>VOTE BREAKDOWN</div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {comp.votes.map((v, i) => {
                                      // Extract reasoning: strip the **VOTE: X** line and return the rest
                                      const reasoning = v.reasoning
                                        .replace(/^\*\*VOTE:\s*\w+\*\*\s*/i, "")
                                        .replace(/^VOTE:\s*\w+\s*/i, "")
                                        .replace(/^\*\*VOTE\s+\d+:\s*.+?\*\*\s*/gim, "")
                                        .replace(/^VOTE\s+\d+:\s*.+?\s*/gim, "")
                                        .trim()
                                        .slice(0, 200);
                                      return (
                                        <div key={i} style={{ padding: "8px 10px", borderRadius: "6px", backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: reasoning ? "4px" : "0" }}>
                                            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-primary)" }}>{v.voter}</span>
                                            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>→</span>
                                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#fbbf24" }}>{v.votedFor}</span>
                                          </div>
                                          {reasoning && (
                                            <div style={{ fontSize: "10px", color: "var(--text-muted)", lineHeight: 1.5 }}>{reasoning}{v.reasoning.length > 200 ? "…" : ""}</div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {activeSession?.status === "completed" && (
                          <>
                            <SessionInsightsPanel
                              insights={sessionInsights}
                              onToggleAction={handleToggleActionItem}
                              extracting={extractingInsights}
                              onExtract={handleExtractInsights}
                            />
                            {(actionItems.length > 0 || extractingActions) && (
                              extractingActions && actionItems.length === 0 ? (
                                <div style={{ margin: "16px 0", padding: "16px", borderRadius: "12px", border: "1px solid rgba(10,132,255,0.3)", backgroundColor: "rgba(10,132,255,0.06)", display: "flex", alignItems: "center", gap: "10px" }}>
                                  <Loader2 size={16} color="#0A84FF" className="animate-spin" />
                                  <span style={{ fontSize: "12px", color: "#0A84FF", fontWeight: 600 }}>Extracting action items for the task board...</span>
                                </div>
                              ) : (
                                <ActionItemsPanel
                                  actions={actionItems}
                                  onPushTask={handlePushActionToTask}
                                  onSkip={handleSkipAction}
                                />
                              )
                            )}
                          </>
                        )}
                        <div ref={eventsEndRef} />
                      </>
                    )}
                  </div>

                  {/* New messages badge */}
                  {showNewMessages && (
                    <div style={{ position: "relative", flexShrink: 0, height: 0 }}>
                      <button
                        onClick={() => { scrollToBottom(); setShowNewMessages(false); }}
                        style={{ position: "absolute", bottom: "16px", left: "50%", transform: "translateX(-50%)", padding: "6px 14px", borderRadius: "20px", border: "1px solid var(--accent)", backgroundColor: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}>
                        <ChevronDown size={12} /> New messages
                      </button>
                    </div>
                  )}

                  {/* Next Turn bar — shown when paused */}
                  {activeSession.status === "active" && isPaused && (
                    <div style={{ padding: "10px 24px", borderTop: "1px solid rgba(251,146,60,0.2)", backgroundColor: "rgba(251,146,60,0.04)", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", flex: 1 }}>
                        {autoPlay ? "Auto-play · Agents will advance automatically" : sessionData?.pacing === "manual" ? "Manual mode · Read the response, then click Next Agent" : "Session paused · Resume or advance"}
                      </span>
                      {/* Auto-play toggle */}
                      <button
                        onClick={() => {
                          const newAutoPlay = !autoPlay;
                          setAutoPlay(newAutoPlay);
                          // If turning on auto-play, immediately trigger next agent
                          // Also handles fresh sessions where no agents have spoken yet
                          if (newAutoPlay && !isGenerating && !advancingTurn) {
                            const hasAgentEvents = eventsRef.current.some(
                              (e) => e.speaker !== "the user" && e.speaker !== "System" && e.type !== "start" && e.type !== "complete"
                            );
                            // Fire immediately whether or not agents have spoken — covers fresh sessions
                            setTimeout(() => handleNextTurn(), hasAgentEvents ? 500 : 200);
                          }
                        }}
                        style={{
                          padding: "6px 14px", borderRadius: "6px",
                          border: `1px solid ${autoPlay ? "rgba(74,222,128,0.5)" : "rgba(139,92,246,0.5)"}`,
                          backgroundColor: autoPlay ? "rgba(74,222,128,0.12)" : "rgba(139,92,246,0.12)",
                          color: autoPlay ? "#4ade80" : "#a78bfa",
                          cursor: "pointer", fontSize: "11px", fontWeight: 700,
                          display: "flex", alignItems: "center", gap: "5px",
                          transition: "all 150ms ease",
                          letterSpacing: "0.3px",
                        }}
                      >
                        {autoPlay ? <Pause size={11} /> : <Play size={11} />}
                        {autoPlay ? "Auto-play ON" : "Auto-play"}
                      </button>
                      {!autoPlay && (
                        <button onClick={handleNextTurn} disabled={advancingTurn || isGenerating}
                          style={{ padding: "8px 16px", borderRadius: "7px", border: "none", backgroundColor: "var(--accent)", color: "#fff", cursor: (advancingTurn || isGenerating) ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", opacity: (advancingTurn || isGenerating) ? 0.7 : 1, fontFamily: "var(--font-heading)" }}>
                          {advancingTurn ? <Loader2 size={13} className="animate-spin" /> : <ChevronRight size={13} />}
                          Next Agent →
                        </button>
                      )}
                    </div>
                  )}

                  {showFormalResume && (
                    <div style={{ padding: "10px 24px", borderTop: "1px solid rgba(250,204,21,0.24)", backgroundColor: "rgba(250,204,21,0.06)", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: "220px" }}>
                        <div style={{ color: "#facc15", fontSize: "11px", fontWeight: 800, letterSpacing: "0.3px", textTransform: "uppercase" }}>
                          Formal review can resume
                        </div>
                        <div style={{ color: "var(--text-muted)", fontSize: "10px", marginTop: "2px" }}>
                          Panely will continue from the next missing formal step without replaying completed seat artifacts.
                        </div>
                      </div>
                      <button
                        onClick={handleResumeFormalReview}
                        disabled={resumingFormalReview}
                        style={{ padding: "7px 13px", borderRadius: "7px", border: "1px solid rgba(250,204,21,0.4)", backgroundColor: "rgba(250,204,21,0.12)", color: "#facc15", cursor: resumingFormalReview ? "not-allowed" : "pointer", fontSize: "11px", fontWeight: 800, display: "flex", alignItems: "center", gap: "6px", opacity: resumingFormalReview ? 0.6 : 1 }}
                      >
                        {resumingFormalReview ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                        {resumingFormalReview ? "Resuming..." : "Resume Formal Review"}
                      </button>
                    </div>
                  )}

                  {/* Human input bar */}
                  {activeSession.status === "active" && (
                    <div className="advisory-input-bar" style={{ padding: "12px 24px 16px", borderTop: "1px solid var(--border)", backgroundColor: "var(--surface)", flexShrink: 0 }}>
                      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <textarea
                            ref={humanInputRef}
                            value={humanMessage}
                            onChange={(e) => setHumanMessage(e.target.value)}
                            placeholder={sessionData?.specialist ? `Continue your conversation with ${sessionData?.specialistAgent || activeSession.agents[0]}...` : "Jump in — share your thoughts or steer the conversation..."}
                            rows={2}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (humanMessage.trim()) handleSendMessage(); }
                              if (e.key === "Enter" && e.metaKey) { e.preventDefault(); if (humanMessage.trim()) handleSendMessage(); }
                            }}
                            style={{ width: "100%", padding: "10px 12px", backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "13px", fontFamily: "var(--font-body)", resize: "none", outline: "none", boxSizing: "border-box" }}
                          />
                          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
                            ↵ to send · Shift+↵ for newline · ⌘N new session · Esc close modal
                          </div>
                        </div>
                        <button onClick={handleSendMessage} disabled={sendingMessage || !humanMessage.trim()}
                          style={{ padding: "10px 18px", borderRadius: "8px", border: "none", backgroundColor: "var(--accent)", color: "#fff", cursor: sendingMessage || !humanMessage.trim() ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", opacity: sendingMessage || !humanMessage.trim() ? 0.5 : 1, flexShrink: 0, fontFamily: "var(--font-heading)", marginTop: "0px", position: "relative", zIndex: 10 }}>
                          {sendingMessage ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                          Send
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Persistent session - Request Full Round button */}
                  {activeSession.status === "active" && sessionData?.rounds === "persistent" && (
                    <div style={{ padding: "10px 24px", borderTop: "1px solid rgba(139,92,246,0.2)", backgroundColor: "rgba(139,92,246,0.04)", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", flex: 1 }}>
                        {sessionData?.specialist ? `Deep dive with ${sessionData?.specialistAgent || activeSession.agents[0]} — ask anything` : "Open-ended session — request another round or Finish for final synthesis"}
                      </span>
                      <button onClick={handleFullRound} disabled={requestingFullRound || isGenerating}
                        style={{ padding: "7px 14px", borderRadius: "7px", border: "1px solid rgba(139,92,246,0.5)", backgroundColor: "rgba(139,92,246,0.12)", color: "#a78bfa", cursor: requestingFullRound || isGenerating ? "not-allowed" : "pointer", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", opacity: requestingFullRound || isGenerating ? 0.6 : 1, fontFamily: "var(--font-heading)", transition: "all 150ms ease" }}>
                        {requestingFullRound ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                        Request Full Round
                      </button>
                    </div>
                  )}

                  {/* Completed session summary */}
                  {activeSession.status === "completed" && (
                    <div style={{ padding: "14px 24px", borderTop: "2px solid rgba(74,222,128,0.4)", backgroundColor: "rgba(74,222,128,0.05)", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, flexWrap: "wrap" }}>
                      <CheckCircle2 size={18} color="#4ade80" />
                      <div style={{ flex: 1, minWidth: "200px" }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#4ade80" }}>
                          Session Complete — {activeSession.title || activeSession.topic.slice(0, 60)}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                          {activeSession.completedAt ? formatDate(activeSession.completedAt) : ""}
                          {activeSession.outcome ? ` · ${activeSession.outcome.replace(/-/g, " ")}` : ""}
                        </div>
                      </div>
                      <button onClick={handleContinueDiscussion} disabled={continuing} title="Reopen session for additional rounds"
                        style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(139,92,246,0.5)", backgroundColor: continuing ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.12)", color: "#a78bfa", cursor: continuing ? "not-allowed" : "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", fontWeight: 700, opacity: continuing ? 0.6 : 1, fontFamily: "var(--font-heading)", transition: "all 150ms ease" }}>
                        {continuing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                        Continue Discussion
                      </button>
                      <button onClick={handleExportMD} title="Export as Markdown file"
                        style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(96,165,250,0.4)", backgroundColor: "rgba(96,165,250,0.1)", color: "#60a5fa", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", fontWeight: 600 }}>
                        <FileDown size={12} /> Export MD
                      </button>
                      <button onClick={handleExportBriefMD} title="Export board brief with transcript"
                        style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(74,222,128,0.4)", backgroundColor: "rgba(74,222,128,0.1)", color: "#4ade80", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", fontWeight: 700 }}>
                        <FileText size={12} /> Brief MD
                      </button>
                      <Link href={`/brief/${activeSession.id}`} target="_blank" title="Open board brief"
                        style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(74,222,128,0.4)", backgroundColor: "rgba(74,222,128,0.08)", color: "#4ade80", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", fontWeight: 700, textDecoration: "none" }}>
                        <FileText size={12} /> Open Brief
                      </Link>
                      {activeSession.mode === "formal-board" && formalArtifactManifest && (
                        <div style={{ flexBasis: "100%", marginTop: "4px", padding: "10px", borderRadius: "8px", border: "1px solid rgba(167,139,250,0.24)", backgroundColor: "rgba(167,139,250,0.06)", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <div style={{ minWidth: "190px", flex: "1 1 220px" }}>
                            <div style={{ color: formalArtifactStatusColor, fontSize: "11px", fontWeight: 800, letterSpacing: "0.3px", textTransform: "uppercase" }}>
                              {formalArtifactStatusLabel}
                            </div>
                            <div style={{ color: "var(--text-muted)", fontSize: "10px", marginTop: "2px" }}>
                              {formalArtifactManifest.sourcePacketHash ? `source ${formalArtifactManifest.sourcePacketHash.slice(0, 12)}` : "source pending"}
                            </div>
                          </div>
                          {formalArtifactActions.map((item) => {
                            const label = item.id === "final-consensus-html"
                              ? "View Handoff"
                              : item.id === "verdict"
                              ? item.canonical ? "Export Verdict" : "Export Invalid Verdict"
                              : item.id === "run-metadata"
                              ? "Export Metadata"
                              : item.id === "source-packet"
                              ? "Export Source"
                              : "Export Handoff Data";
                            const download = item.id !== "final-consensus-html";
                            return (
                              <button
                                key={item.id}
                                onClick={() => openFormalArtifact(item.id, download)}
                                disabled={!item.exists}
                                title={item.exists ? `${label}: ${item.relativePath}` : `Missing: ${item.relativePath}`}
                                style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(167,139,250,0.36)", backgroundColor: item.exists ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.04)", color: item.exists ? "#c4b5fd" : "var(--text-muted)", cursor: item.exists ? "pointer" : "not-allowed", fontSize: "10px", display: "flex", alignItems: "center", gap: "5px", fontWeight: 700, opacity: item.exists ? 1 : 0.56 }}>
                                {download ? <FileDown size={11} /> : <FileText size={11} />}
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <button onClick={handleExportPDF} disabled={exportingPDF} title="Open printable artifact"
                        style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(139,92,246,0.4)", backgroundColor: exportingPDF ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.08)", color: "#a78bfa", cursor: exportingPDF ? "not-allowed" : "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", fontWeight: 600, opacity: exportingPDF ? 0.6 : 1 }}>
                        {exportingPDF ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
                        {exportingPDF ? "Opening..." : "Print / PDF"}
                      </button>
                      <button onClick={() => handleArchive(false)} disabled={archiving} title="Archive session to workspace memory"
                        style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(74,222,128,0.3)", backgroundColor: "rgba(74,222,128,0.08)", color: "#4ade80", cursor: archiving ? "not-allowed" : "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", fontWeight: 600, opacity: archiving ? 0.6 : 1 }}>
                        {archiving ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
                        {archiving ? "Archiving..." : "Archive"}
                      </button>
                    </div>
                  )}
                </div>{/* close events column */}
              </div>{/* close horizontal split */}
            </>
          ) : (
            /* Landing page — brief-first empty state */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", overflow: "auto", background: "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.08) 0%, transparent 60%)" }}>
              {/* Hero */}
              <div style={{ textAlign: "center", maxWidth: "620px", marginBottom: "30px" }}>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "12px", fontFamily: "var(--font-heading)", lineHeight: 1.2 }}>
                  Start with the question
                </div>
                <div style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.7, marginBottom: "24px" }}>
                  Describe the decision, plan, or document you want reviewed. Panely will generate the right temporary advisors, define what each one does, and assign specific models and thinking levels before you start.
                </div>
                <button
                  onClick={() => setShowLaunchModal(true)}
                  style={{
                    padding: "12px 32px",
                    borderRadius: "10px",
                    border: "none",
                    backgroundColor: "var(--accent)",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    fontFamily: "var(--font-heading)",
                    boxShadow: "0 4px 16px rgba(139,92,246,0.3)",
                    transition: "transform 150ms ease, box-shadow 150ms ease",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(139,92,246,0.4)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(139,92,246,0.3)"; }}
                >
                  <Plus size={16} /> Start New Session
                </button>
              </div>

              {/* Feature pills */}
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                {[
                  { icon: "↻", label: "Roundtable" },
                  { icon: "⚔", label: "Competitive" },
                  { icon: "□", label: "File review" },
                  { icon: "◉", label: "Model control" },
                ].map((f) => (
                  <span key={f.label} style={{ padding: "5px 14px", borderRadius: "20px", border: "1px solid var(--border)", backgroundColor: "var(--surface)", fontSize: "11px", color: "var(--text-muted)", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    {f.icon} {f.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR — toggleable panel for Participants & Session Info (no Legend) */}
      </div>

      {/* ─── Modals ──────────────────────────────────────────────────────────── */}

      {showLaunchModal && (
        <LaunchWizard
          onClose={() => setShowLaunchModal(false)}
          onLaunch={handleLaunch}
          customAgents={customAgents}
          onCustomAgentsChange={loadCustomAgents}
          onDeepDive={handleDeepDive}
        />
      )}

      {showCompareView && compareSessions[0] && compareSessions[1] && (
        <SessionComparison
          sessions={[compareSessions[0], compareSessions[1]]}
          onClose={() => setShowCompareView(false)}
        />
      )}

      {deepDiveAgent && (
        <DeepDiveModal
          agent={deepDiveAgent}
          onClose={() => setDeepDiveAgent(null)}
          onLaunch={handleLaunchDeepDive}
        />
      )}
    </>
  );
}
