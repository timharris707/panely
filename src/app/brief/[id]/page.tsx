import Link from "next/link";
import type { ReactNode } from "react";
import { buildBoardBrief } from "@/lib/advisory-brief";
import { getAdvisorySession } from "@/lib/advisory-session-store";
import { getCurrentUser } from "@/lib/local-user";
import type { AdvisorySession, BoardBrief } from "@/types/advisory";

type BriefSession = AdvisorySession & {
  responseLength?: string;
};

function canAccess(session: unknown, userId: string) {
  const maybeSession = session as { userId?: unknown };
  return typeof maybeSession.userId !== "string" || maybeSession.userId === userId;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(durationMs?: number) {
  if (typeof durationMs !== "number") return "";
  return ` · ${(durationMs / 1000).toFixed(1)}s`;
}

function modeLabel(mode: string) {
  if (mode === "competitive") return "Competitive";
  if (mode === "formal-board") return "Formal Board Review";
  return "Roundtable";
}

function responseLabel(responseLength?: string) {
  if (!responseLength) return "";
  return `${responseLength.charAt(0).toUpperCase()}${responseLength.slice(1)} responses`;
}

function uniqueModels(session: BriefSession, brief: BoardBrief) {
  return [
    ...new Set(
      [
        session.model,
        ...brief.modelProvenance.map((item) => item.model),
        ...(session.events || []).map((event) => event.model),
      ].filter((model): model is string => Boolean(model))
    ),
  ];
}

function MetaChip({ children }: { children: ReactNode }) {
  return <span className="brief-meta-chip">{children}</span>;
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="brief-section">
      <div className="brief-section-label">{label}</div>
      {children}
    </section>
  );
}

const briefStyles = `
  * {
    box-sizing: border-box;
  }

  html,
  body {
    background: #f8fafc !important;
    color: #1e293b !important;
  }

  .brief-page {
    min-height: 100vh;
    padding: 24px 18px 40px;
    background: #f8fafc;
    color: #1e293b;
    font-family: "Georgia", "Times New Roman", "Cambria", serif;
    font-size: 11px;
    line-height: 1.7;
  }

  .brief-toolbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    max-width: 900px;
    margin: 0 auto 18px;
    padding: 12px 18px;
    border: 1px solid #dbe3ef;
    border-radius: 8px;
    background: #ffffff;
    color: #334155;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  }

  .brief-toolbar-title {
    display: block;
    color: #0f172a;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.25;
  }

  .brief-toolbar-subtitle {
    display: block;
    color: #64748b;
    font-size: 11px;
    margin-top: 2px;
  }

  .brief-back-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
    padding: 7px 12px;
    border: 1px solid #6d28d9;
    border-radius: 6px;
    background: #6d28d9;
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
  }

  .brief-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 28px;
    background: #ffffff;
    box-shadow: 0 18px 60px rgba(15, 23, 42, 0.08);
  }

  .brief-header {
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 2px solid #e2e8f0;
  }

  .brief-brand {
    margin-bottom: 8px;
    color: #6d28d9;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 2.5px;
    line-height: 1.3;
    text-transform: uppercase;
  }

  .brief-title {
    margin: 0 0 12px;
    color: #0f172a;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0;
    line-height: 1.3;
  }

  .brief-topic {
    margin: -4px 0 14px;
    color: #475569;
    font-size: 11px;
    line-height: 1.65;
  }

  .brief-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .brief-meta-chip {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    padding: 3px 10px;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    background: #f1f5f9;
    color: #475569;
    font-family: "SF Mono", "Fira Code", "Consolas", monospace;
    font-size: 9px;
    font-weight: 700;
    line-height: 1.2;
  }

  .brief-section {
    margin-top: 20px;
  }

  .brief-section-label {
    margin-bottom: 8px;
    color: #64748b;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 2px;
    line-height: 1.4;
    text-transform: uppercase;
  }

  .brief-muted {
    margin: 0;
    color: #334155;
    font-size: 11px;
    line-height: 1.75;
    white-space: pre-wrap;
  }

  .brief-muted {
    color: #64748b;
    font-style: italic;
  }

  .brief-participants {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 20px;
  }

  .brief-participant {
    padding: 4px 10px;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    background: #f8fafc;
    color: #334155;
    font-size: 10px;
    font-weight: 700;
  }

  .brief-divider {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 20px 0;
  }

  .brief-provenance {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .brief-provenance-item {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: baseline;
    padding: 10px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #f8fafc;
    color: #334155;
    font-size: 10px;
  }

  .brief-provenance-agent {
    color: #0f172a;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-size: 11px;
    font-weight: 800;
  }

  .brief-provenance-model,
  .brief-provenance-status {
    color: #64748b;
    font-family: "SF Mono", "Fira Code", "Consolas", monospace;
    font-size: 9px;
  }

  .brief-markdown {
    margin: 0 0 18px;
    padding: 14px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #f8fafc;
    color: #1e293b;
    font-family: "SF Mono", "Fira Code", "Consolas", monospace;
    font-size: 9px;
    line-height: 1.55;
    overflow-x: auto;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .brief-footer {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
    color: #94a3b8;
    font-size: 8px;
  }

  .brief-footer-brand {
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .brief-not-found {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background: #f8fafc;
    color: #1e293b;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }

  .brief-not-found-card {
    width: min(100%, 520px);
    padding: 28px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 18px 60px rgba(15, 23, 42, 0.08);
  }

  .brief-not-found-title {
    margin: 0 0 10px;
    color: #0f172a;
    font-size: 20px;
    line-height: 1.3;
  }

  @media (max-width: 680px) {
    .brief-page {
      padding: 12px 10px 28px;
    }

    .brief-toolbar {
      position: static;
      align-items: stretch;
      flex-direction: column;
    }

    .brief-back-link {
      width: 100%;
    }

    .brief-container {
      padding: 20px;
    }

    .brief-footer {
      flex-direction: column;
    }
  }

  @media print {
    .brief-page {
      padding: 0;
      background: #ffffff;
    }

    .brief-toolbar {
      display: none;
    }

    .brief-container {
      max-width: 100%;
      padding: 0;
      box-shadow: none;
    }
  }
`;

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const session = getAdvisorySession(id) as BriefSession | null;

  if (!session || !canAccess(session, user.id)) {
    return (
      <main className="brief-not-found">
        <style dangerouslySetInnerHTML={{ __html: briefStyles }} />
        <div className="brief-not-found-card">
          <div className="brief-brand">Panely Advisory Board</div>
          <h1 className="brief-not-found-title">Brief not found</h1>
          <p className="brief-muted">The requested board brief is unavailable or belongs to another local user.</p>
          <hr className="brief-divider" />
          <Link href="/advisory" className="brief-back-link">Back to Panely</Link>
        </div>
      </main>
    );
  }

  const brief = session.brief || buildBoardBrief(session);
  const models = uniqueModels(session, brief);
  const responseLength = responseLabel(session.responseLength);

  return (
    <main className="brief-page">
      <style dangerouslySetInnerHTML={{ __html: briefStyles }} />
      <div className="brief-toolbar">
        <div>
          <span className="brief-toolbar-title">Board brief</span>
          <span className="brief-toolbar-subtitle">Session decision record</span>
        </div>
        <Link href="/advisory" className="brief-back-link">Back to Panely</Link>
      </div>

      <article className="brief-container">
        <header className="brief-header">
          <div className="brief-brand">Panely Advisory Board</div>
          <h1 className="brief-title">{brief.title}</h1>
          <p className="brief-topic">{brief.topic}</p>
          <div className="brief-meta">
            <MetaChip>{formatDate(brief.generatedAt || session.createdAt)}</MetaChip>
            <MetaChip>{modeLabel(brief.mode)}</MetaChip>
            <MetaChip>{brief.status.charAt(0).toUpperCase() + brief.status.slice(1)}</MetaChip>
            {responseLength ? <MetaChip>{responseLength}</MetaChip> : null}
            {session.completedAt ? <MetaChip>Completed {formatDate(session.completedAt)}</MetaChip> : null}
            {models.length ? <MetaChip>{models.join(", ")}</MetaChip> : null}
          </div>
        </header>

        <Section label="Board Brief">
          <pre className="brief-markdown">{brief.markdown}</pre>
        </Section>

        <hr className="brief-divider" />

        <Section label="Participants">
          <div className="brief-participants">
            {session.agents.length ? (
              session.agents.map((agent) => (
                <span className="brief-participant" key={agent}>{agent}</span>
              ))
            ) : (
              <p className="brief-muted">No participants were recorded.</p>
            )}
          </div>
        </Section>

        <Section label="Model Provenance">
          {brief.modelProvenance.length ? (
            <ul className="brief-provenance">
              {brief.modelProvenance.map((item, index) => (
                <li className="brief-provenance-item" key={`${index}-${item.agent}`}>
                  <span className="brief-provenance-agent">{item.agent}</span>
                  <span className="brief-provenance-model">{item.model || "unknown model"}</span>
                  <span className="brief-provenance-status">{item.status || "unknown"}{formatDuration(item.durationMs)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="brief-muted">No model provenance was recorded.</p>
          )}
        </Section>

        <footer className="brief-footer">
          <span className="brief-footer-brand">Panely Advisory Board</span>
          <span>Session: {session.id.slice(0, 8)}</span>
        </footer>
      </article>
    </main>
  );
}
