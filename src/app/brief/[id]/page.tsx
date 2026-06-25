import Link from "next/link";
import { buildBoardBrief } from "@/lib/advisory-brief";
import { getAdvisorySession } from "@/lib/advisory-session-store";
import { getCurrentUser } from "@/lib/local-user";
import type { AdvisorySession } from "@/types/advisory";

function canAccess(session: Record<string, unknown>, userId: string) {
  return typeof session.userId !== "string" || session.userId === userId;
}

function sectionList(items: string[], empty: string) {
  return items.length ? (
    <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>
  ) : (
    <p>{empty}</p>
  );
}

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const session = getAdvisorySession(id);

  if (!session || !canAccess(session, user.id)) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0d10", color: "#f4f7fb", fontFamily: "system-ui, sans-serif" }}>
        <div>
          <h1>Brief not found</h1>
          <Link href="/advisory" style={{ color: "#8ea2ff" }}>Back to Panely</Link>
        </div>
      </main>
    );
  }

  const brief = (session as AdvisorySession).brief || buildBoardBrief(session as AdvisorySession);

  return (
    <main style={{ minHeight: "100vh", background: "#0b0d10", color: "#f4f7fb", fontFamily: "system-ui, sans-serif", padding: "32px" }}>
      <article style={{ maxWidth: 920, margin: "0 auto", background: "#15181d", border: "1px solid #313844", borderRadius: 10, padding: 28 }}>
        <Link href="/advisory" style={{ color: "#a7b0bd", textDecoration: "none", fontSize: 13 }}>Back to Panely</Link>
        <h1 style={{ margin: "16px 0 8px", fontSize: 34, lineHeight: 1.1 }}>{brief.title}</h1>
        <p style={{ color: "#a7b0bd", marginTop: 0 }}>{brief.topic}</p>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, margin: "20px 0" }}>
          <div style={{ border: "1px solid #313844", borderRadius: 8, padding: 12 }}><strong>Mode</strong><br />{brief.mode}</div>
          <div style={{ border: "1px solid #313844", borderRadius: 8, padding: 12 }}><strong>Status</strong><br />{brief.status}</div>
          <div style={{ border: "1px solid #313844", borderRadius: 8, padding: 12 }}><strong>Generated</strong><br />{new Date(brief.generatedAt).toLocaleString()}</div>
        </section>

        <h2>Decision</h2>
        <p style={{ color: "#dce6f5", whiteSpace: "pre-wrap" }}>{brief.decision}</p>

        <h2>Recommendation</h2>
        <p style={{ color: "#dce6f5" }}>{brief.recommendation}</p>

        <h2>Top Ideas</h2>
        {brief.topIdeas.length ? (
          <ol>{brief.topIdeas.map((idea) => <li key={`${idea.rank}-${idea.idea}`}>{idea.idea}{typeof idea.votes === "number" ? ` (${idea.votes} votes)` : ""}</li>)}</ol>
        ) : <p>No ranked ideas were recorded.</p>}

        <h2>Dissent and Caveats</h2>
        {sectionList(brief.dissent, "No explicit dissent was recorded.")}

        <h2>Risks</h2>
        {sectionList(brief.risks, "No explicit risks were extracted.")}

        <h2>Action Items</h2>
        {sectionList(brief.actionItems, "No action items were extracted.")}

        <h2>Model Provenance</h2>
        {brief.modelProvenance.length ? (
          <ul>{brief.modelProvenance.map((item, index) => <li key={index}>{item.agent}: {item.model || "unknown"} · {item.status || "unknown"}{typeof item.durationMs === "number" ? ` · ${(item.durationMs / 1000).toFixed(1)}s` : ""}</li>)}</ul>
        ) : <p>No model provenance was recorded.</p>}

        <details style={{ marginTop: 24 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Markdown Artifact</summary>
          <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", background: "#0f1217", border: "1px solid #313844", borderRadius: 8, padding: 16 }}>{brief.markdown}</pre>
        </details>
      </article>
    </main>
  );
}
