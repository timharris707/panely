"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Gavel,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

const macDownloadUrl = "/downloads/Panely-1.0.0.dmg";
const checksumUrl = "/downloads/Panely-1.0.0.dmg.sha256";
const releaseUrl = "https://github.com/timharris707/panely-mac/releases/tag/v1.0.0";

const proofPoints = [
  "Signed and notarized Developer ID app",
  "Gatekeeper-ready direct download",
  "Source-safe workflow evidence behind v1.0",
];

const workflows = [
  {
    icon: Users,
    title: "Roundtable",
    body: "Ask a serious question and let a panel of advisors examine the same brief from different angles before producing a usable synthesis.",
  },
  {
    icon: Sparkles,
    title: "Competitive",
    body: "Force sharper thinking with proposal, critique, and vote rounds when you need options compared instead of softened into consensus.",
  },
  {
    icon: Gavel,
    title: "Formal Board",
    body: "Run high-stakes reviews through stricter source-packet, provider-disclosure, artifact, and verdict gates where the protocol is implemented.",
  },
];

const trustItems = [
  "Local session storage and Finder-owned artifacts",
  "Explicit provider disclosure before model work",
  "Exportable Markdown, HTML, PDF, JSON, and transcript records",
  "Narrow v1 claims with post-1.0 caveats documented",
];

export default function Home() {
  return (
    <main className="marketing-page">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-media" aria-hidden="true">
          <Image
            src="/images/panely-mac-workbench.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="hero-image"
          />
          <div className="hero-scrim" />
        </div>

        <nav className="topbar" aria-label="Primary navigation">
          <Link href="/" className="brand-link" aria-label="Panely home">
            Panely
          </Link>
          <div className="topbar-actions">
            <Link href="/advisory" className="text-link">
              Web app
            </Link>
            <a href={releaseUrl} className="text-link">
              Release notes
            </a>
          </div>
        </nav>

        <div className="hero-content">
          <p className="eyebrow">Panely Mac 1.0 is ready</p>
          <h1 id="hero-title">Panely Mac</h1>
          <p className="lede">
            A native, local-first advisory room for serious decisions. Run
            Roundtable, Competitive, and implemented Formal Board workflows with
            local model CLIs, source-safe review gates, and user-owned artifacts.
          </p>

          <div className="hero-actions">
            <a href={macDownloadUrl} download className="primary-download">
              <Download size={18} aria-hidden="true" />
              Download for Mac
            </a>
            <a href={releaseUrl} className="secondary-download">
              View v1.0 release
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>

          <div className="download-meta" aria-label="Mac download details">
            <span>v1.0.0</span>
            <span>macOS 14 or later</span>
            <span>Apple silicon</span>
            <a href={checksumUrl}>SHA-256</a>
          </div>

          <div className="proof-strip" aria-label="Release proof">
            {proofPoints.map((point) => (
              <span key={point}>
                <CheckCircle2 size={16} aria-hidden="true" />
                {point}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="section download-panel" aria-labelledby="download-title">
        <div>
          <p className="section-kicker">Direct Mac download</p>
          <h2 id="download-title">Install the native app. Keep the work local.</h2>
          <p>
            Panely Mac ships in a DMG containing the signed, notarized app. Drag
            the app to Applications, open it normally, and connect the local
            model tools you already use.
          </p>
        </div>
        <div className="install-steps" aria-label="Installation steps">
          <div>
            <strong>1</strong>
            <span>Download the DMG</span>
          </div>
          <div>
            <strong>2</strong>
            <span>Drag Panely to Applications</span>
          </div>
          <div>
            <strong>3</strong>
            <span>Launch and choose your first workflow</span>
          </div>
        </div>
      </section>

      <section className="section workflow-section" aria-labelledby="workflow-title">
        <div className="section-heading">
          <p className="section-kicker">Built for decisions with consequences</p>
          <h2 id="workflow-title">Three rooms for different kinds of thinking.</h2>
        </div>
        <div className="workflow-grid">
          {workflows.map(({ icon: Icon, title, body }) => (
            <article className="workflow-card" key={title}>
              <Icon size={22} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section trust-section" aria-labelledby="trust-title">
        <div>
          <p className="section-kicker">First-user-ready, not overclaimed</p>
          <h2 id="trust-title">Serious workflow proof without pretending every future feature is done.</h2>
        </div>
        <div className="trust-list">
          {trustItems.map((item) => (
            <div key={item}>
              <ShieldCheck size={18} aria-hidden="true" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section artifact-section" aria-labelledby="artifact-title">
        <div className="artifact-copy">
          <p className="section-kicker">Artifacts, not just chat</p>
          <h2 id="artifact-title">Walk away with records you can inspect, export, and share.</h2>
          <p>
            Panely creates decision records, vote breakdowns, transcripts, and
            generated artifact bundles that live on disk. Formal Board artifact
            surfaces stay gated by source confirmation and verification checks.
          </p>
        </div>
        <div className="artifact-list" aria-label="Artifact outputs">
          {["Decision memo", "Vote breakdown", "Printable brief", "Transcript", "Formal Board verdict"].map((item) => (
            <span key={item}>
              <FileText size={15} aria-hidden="true" />
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="final-cta" aria-labelledby="final-title">
        <h2 id="final-title">Download Panely Mac 1.0</h2>
        <p>
          Start with a real decision, connect your local model tools, and let
          the room argue its way toward a clear next move.
        </p>
        <a href={macDownloadUrl} download className="primary-download">
          <Download size={18} aria-hidden="true" />
          Download DMG
        </a>
      </section>

      <style jsx global>{`
        .marketing-page {
          min-height: 100vh;
          color: #f5f7fb;
          background: #090a0d;
          font-family: var(--font-body);
        }

        .hero {
          position: relative;
          min-height: 92vh;
          overflow: hidden;
          display: grid;
          align-content: space-between;
          padding: 28px;
        }

        .hero-media {
          position: absolute;
          inset: 0;
          z-index: 0;
        }

        .hero-image {
          object-fit: cover;
          object-position: 62% 46%;
          opacity: 0.74;
          filter: saturate(1.04) contrast(1.08);
        }

        .hero-scrim {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(9, 10, 13, 0.96) 0%, rgba(9, 10, 13, 0.84) 38%, rgba(9, 10, 13, 0.35) 72%, rgba(9, 10, 13, 0.68) 100%),
            linear-gradient(180deg, rgba(9, 10, 13, 0.7) 0%, rgba(9, 10, 13, 0.24) 46%, rgba(9, 10, 13, 0.98) 100%);
        }

        .topbar,
        .hero-content {
          position: relative;
          z-index: 1;
        }

        .topbar {
          width: min(1180px, 100%);
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .brand-link {
          color: #f5f7fb;
          font-family: var(--font-heading);
          font-size: 22px;
          font-weight: 850;
          letter-spacing: 0;
          text-decoration: none;
        }

        .brand-link::after {
          content: ".";
          color: #7c8cff;
        }

        .topbar-actions {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .text-link {
          color: rgba(245, 247, 251, 0.74);
          font-size: 14px;
          font-weight: 760;
          text-decoration: none;
        }

        .text-link:hover {
          color: #ffffff;
        }

        .hero-content {
          width: min(1180px, 100%);
          margin: 0 auto;
          padding: 12vh 0 7vh;
        }

        .eyebrow,
        .section-kicker {
          margin: 0 0 14px;
          color: #77e6d4;
          font-size: 12px;
          font-weight: 850;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .hero h1 {
          margin: 0;
          max-width: 760px;
          font-family: var(--font-heading);
          font-size: clamp(64px, 11vw, 132px);
          line-height: 0.9;
          letter-spacing: 0;
          font-weight: 900;
        }

        .lede {
          margin: 28px 0 0;
          max-width: 690px;
          color: rgba(245, 247, 251, 0.82);
          font-size: clamp(18px, 2.3vw, 24px);
          line-height: 1.5;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 36px;
        }

        .primary-download,
        .secondary-download {
          min-height: 52px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border-radius: 8px;
          padding: 0 20px;
          font-size: 15px;
          font-weight: 850;
          text-decoration: none;
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
        }

        .primary-download {
          color: #08090b;
          background: #f5f7fb;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.34);
        }

        .secondary-download {
          color: #f5f7fb;
          border: 1px solid rgba(245, 247, 251, 0.2);
          background: rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(14px);
        }

        .primary-download:hover,
        .secondary-download:hover {
          transform: translateY(-1px);
        }

        .secondary-download:hover {
          border-color: rgba(119, 230, 212, 0.55);
          background: rgba(119, 230, 212, 0.1);
        }

        .download-meta,
        .proof-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 18px;
        }

        .download-meta span,
        .download-meta a,
        .proof-strip span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border-radius: 999px;
          border: 1px solid rgba(245, 247, 251, 0.14);
          color: rgba(245, 247, 251, 0.75);
          background: rgba(9, 10, 13, 0.46);
          padding: 8px 11px;
          font-size: 12px;
          font-weight: 760;
          text-decoration: none;
          backdrop-filter: blur(12px);
        }

        .download-meta a:hover {
          color: #ffffff;
          border-color: rgba(124, 140, 255, 0.52);
        }

        .proof-strip {
          margin-top: 28px;
        }

        .proof-strip span {
          border-color: rgba(119, 230, 212, 0.22);
          color: rgba(245, 247, 251, 0.84);
        }

        .proof-strip svg {
          color: #77e6d4;
        }

        .section {
          width: min(1180px, calc(100% - 48px));
          margin: 0 auto;
          padding: 86px 0;
        }

        .section h2,
        .final-cta h2 {
          margin: 0;
          font-family: var(--font-heading);
          font-size: clamp(34px, 5vw, 58px);
          line-height: 1;
          letter-spacing: 0;
          font-weight: 870;
        }

        .section p,
        .final-cta p {
          color: #aeb8c6;
          font-size: 17px;
          line-height: 1.7;
        }

        .download-panel {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(340px, 0.72fr);
          gap: 48px;
          align-items: center;
          border-bottom: 1px solid rgba(245, 247, 251, 0.08);
        }

        .install-steps {
          display: grid;
          gap: 12px;
        }

        .install-steps div {
          display: grid;
          grid-template-columns: 44px 1fr;
          align-items: center;
          min-height: 62px;
          border-radius: 8px;
          border: 1px solid rgba(245, 247, 251, 0.1);
          background: #12161d;
          padding: 10px 14px;
        }

        .install-steps strong {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          color: #090a0d;
          background: #f3c969;
          font-size: 13px;
        }

        .install-steps span {
          color: #e9eef7;
          font-weight: 780;
        }

        .section-heading {
          max-width: 780px;
        }

        .workflow-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 34px;
        }

        .workflow-card {
          min-height: 260px;
          border-radius: 8px;
          border: 1px solid rgba(245, 247, 251, 0.1);
          background: #11151c;
          padding: 26px;
        }

        .workflow-card svg {
          color: #7c8cff;
        }

        .workflow-card h3 {
          margin: 22px 0 12px;
          font-family: var(--font-heading);
          font-size: 22px;
          letter-spacing: 0;
        }

        .workflow-card p {
          margin: 0;
          font-size: 15px;
        }

        .trust-section {
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(340px, 0.8fr);
          gap: 54px;
          align-items: start;
          border-top: 1px solid rgba(245, 247, 251, 0.08);
          border-bottom: 1px solid rgba(245, 247, 251, 0.08);
        }

        .trust-list {
          display: grid;
          gap: 12px;
        }

        .trust-list div,
        .artifact-list span {
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 8px;
          border: 1px solid rgba(245, 247, 251, 0.1);
          color: #e9eef7;
          background: #12161d;
          padding: 14px;
          font-weight: 760;
        }

        .trust-list svg {
          flex: 0 0 auto;
          color: #77e6d4;
        }

        .artifact-section {
          display: grid;
          grid-template-columns: minmax(0, 0.82fr) minmax(340px, 1fr);
          gap: 48px;
          align-items: center;
        }

        .artifact-list {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .artifact-list span {
          background: #141821;
        }

        .artifact-list svg {
          color: #f3c969;
        }

        .final-cta {
          width: min(1180px, calc(100% - 48px));
          margin: 0 auto 42px;
          display: grid;
          justify-items: start;
          gap: 18px;
          border-radius: 8px;
          border: 1px solid rgba(245, 247, 251, 0.1);
          background:
            linear-gradient(135deg, rgba(124, 140, 255, 0.18), transparent 38%),
            #11151c;
          padding: 44px;
        }

        .final-cta p {
          max-width: 680px;
          margin: 0;
        }

        @media (max-width: 900px) {
          .hero {
            min-height: 820px;
          }

          .hero-image {
            object-position: center bottom;
            opacity: 0.5;
          }

          .hero-scrim {
            background:
              linear-gradient(180deg, rgba(9, 10, 13, 0.97) 0%, rgba(9, 10, 13, 0.78) 46%, rgba(9, 10, 13, 0.99) 100%);
          }

          .hero-content {
            padding-top: 10vh;
          }

          .download-panel,
          .trust-section,
          .artifact-section {
            grid-template-columns: 1fr;
          }

          .workflow-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .hero {
            padding: 20px;
          }

          .topbar {
            align-items: flex-start;
          }

          .topbar-actions {
            flex-direction: column;
            align-items: flex-end;
            gap: 8px;
          }

          .hero-actions,
          .primary-download,
          .secondary-download {
            width: 100%;
          }

          .section,
          .final-cta {
            width: min(100% - 32px, 1180px);
          }

          .final-cta {
            padding: 28px;
          }
        }
      `}</style>
    </main>
  );
}
