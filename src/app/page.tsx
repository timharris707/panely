"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

const advisorNodes = [
  { label: "S", role: "Strategy", color: "#7c8cff", delay: "0s" },
  { label: "R", role: "Risk", color: "#f3c969", delay: "-1.2s" },
  { label: "O", role: "Operator", color: "#2dd4bf", delay: "-2.4s" },
  { label: "C", role: "Critic", color: "#f472b6", delay: "-3.6s" },
  { label: "D", role: "Decision", color: "#60a5fa", delay: "-4.8s" },
];

function BoardAnimation() {
  return (
    <div className="entry-board" aria-hidden="true">
      <div className="board-grid" />
      <div className="decision-core">
        <div className="core-line short" />
        <div className="core-line" />
        <div className="core-line muted" />
      </div>
      {advisorNodes.map((node, index) => (
        <div
          className={`advisor-node node-${index + 1}`}
          key={node.label}
          style={{
            "--node-color": node.color,
            "--delay": node.delay,
          } as CSSProperties}
        >
          <span>{node.label}</span>
          <small>{node.role}</small>
        </div>
      ))}
      <div className="signal-ring ring-one" />
      <div className="signal-ring ring-two" />
    </div>
  );
}

export default function Home() {
  return (
    <main className="entry-page">
      <section className="entry-shell">
        <div className="entry-copy">
          <Link href="/advisory" className="brand-link" aria-label="Enter Panely">
            Panely
          </Link>
          <h1>Open your advisory room.</h1>
          <p>
            Start a local AI roundtable, review a plan, or stress-test a decision with the models available on this machine.
          </p>
          <div className="entry-actions">
            <Link href="/advisory" className="entry-primary">
              Enter Panely
            </Link>
            <Link href="/advisory/settings" className="entry-secondary">
              Model settings
            </Link>
          </div>
          <div className="entry-meta" aria-label="Panely setup notes">
            <span>Local CLI routing</span>
            <span>Availability-aware setup</span>
            <span>Private by default</span>
          </div>
        </div>
        <BoardAnimation />
      </section>

      <style jsx global>{`
        .entry-page {
          min-height: 100vh;
          overflow: hidden;
          display: grid;
          place-items: center;
          padding: 32px;
          color: #eef2f7;
          background:
            radial-gradient(circle at 15% 18%, rgba(45, 212, 191, 0.12), transparent 28%),
            radial-gradient(circle at 82% 20%, rgba(243, 201, 105, 0.1), transparent 24%),
            linear-gradient(135deg, #08090b 0%, #111318 48%, #07080a 100%);
        }

        .entry-shell {
          width: min(1120px, 100%);
          min-height: min(680px, calc(100vh - 64px));
          display: grid;
          grid-template-columns: minmax(0, 0.94fr) minmax(360px, 1.06fr);
          align-items: center;
          gap: 54px;
        }

        .entry-copy {
          max-width: 520px;
        }

        .brand-link {
          display: inline-flex;
          margin-bottom: 34px;
          color: #eef2f7;
          font-family: var(--font-heading);
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 0;
          text-decoration: none;
        }

        .brand-link::after {
          content: ".";
          color: #7c8cff;
        }

        .entry-copy h1 {
          margin: 0;
          max-width: 560px;
          font-family: var(--font-heading);
          font-size: clamp(48px, 7vw, 86px);
          line-height: 0.96;
          letter-spacing: 0;
          font-weight: 850;
        }

        .entry-copy p {
          margin: 24px 0 0;
          max-width: 520px;
          color: #a7b0bd;
          font-size: 18px;
          line-height: 1.65;
        }

        .entry-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 36px;
        }

        .entry-primary,
        .entry-secondary {
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          padding: 0 20px;
          font-size: 15px;
          font-weight: 800;
          text-decoration: none;
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
        }

        .entry-primary {
          color: #08090b;
          background: #eef2f7;
        }

        .entry-secondary {
          color: #dce3ec;
          border: 1px solid rgba(238, 242, 247, 0.18);
          background: rgba(255, 255, 255, 0.045);
        }

        .entry-primary:hover,
        .entry-secondary:hover {
          transform: translateY(-1px);
        }

        .entry-secondary:hover {
          border-color: rgba(124, 140, 255, 0.5);
          background: rgba(124, 140, 255, 0.12);
        }

        .entry-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 28px;
        }

        .entry-meta span {
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          padding: 7px 10px;
          color: #8d97a7;
          background: rgba(255, 255, 255, 0.035);
          font-size: 12px;
          font-weight: 750;
        }

        .entry-board {
          position: relative;
          width: min(520px, 100%);
          aspect-ratio: 1;
          justify-self: center;
          border-radius: 28px;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.025)),
            radial-gradient(circle at center, rgba(124, 140, 255, 0.16), transparent 58%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 36px 90px rgba(0, 0, 0, 0.38);
          overflow: hidden;
        }

        .board-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(circle at center, black 0%, transparent 74%);
        }

        .decision-core {
          position: absolute;
          inset: 50%;
          width: 164px;
          height: 120px;
          transform: translate(-50%, -50%);
          display: grid;
          align-content: center;
          gap: 12px;
          padding: 24px;
          border-radius: 18px;
          border: 1px solid rgba(238, 242, 247, 0.16);
          background: rgba(8, 9, 11, 0.72);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 20px 50px rgba(0, 0, 0, 0.35);
        }

        .core-line {
          height: 8px;
          border-radius: 999px;
          background: #eef2f7;
        }

        .core-line.short {
          width: 62%;
          background: #7c8cff;
        }

        .core-line.muted {
          width: 82%;
          background: rgba(238, 242, 247, 0.28);
        }

        .advisor-node {
          --radius: 188px;
          position: absolute;
          left: 50%;
          top: 50%;
          width: 94px;
          height: 94px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 3px;
          border-radius: 999px;
          color: #eef2f7;
          border: 1px solid color-mix(in srgb, var(--node-color) 72%, transparent);
          background: color-mix(in srgb, var(--node-color) 20%, rgba(8, 9, 11, 0.86));
          box-shadow: 0 0 34px color-mix(in srgb, var(--node-color) 30%, transparent);
          animation: floatNode 6s ease-in-out infinite;
          animation-delay: var(--delay);
        }

        .advisor-node span {
          font-size: 24px;
          font-weight: 900;
        }

        .advisor-node small {
          color: rgba(238, 242, 247, 0.7);
          font-size: 11px;
          font-weight: 800;
        }

        .node-1 { transform: translate(-50%, -50%) rotate(-88deg) translateX(var(--radius)) rotate(88deg); }
        .node-2 { transform: translate(-50%, -50%) rotate(-18deg) translateX(var(--radius)) rotate(18deg); }
        .node-3 { transform: translate(-50%, -50%) rotate(55deg) translateX(var(--radius)) rotate(-55deg); }
        .node-4 { transform: translate(-50%, -50%) rotate(128deg) translateX(var(--radius)) rotate(-128deg); }
        .node-5 { transform: translate(-50%, -50%) rotate(198deg) translateX(var(--radius)) rotate(-198deg); }

        .signal-ring {
          position: absolute;
          inset: 92px;
          border-radius: 999px;
          border: 1px solid rgba(124, 140, 255, 0.23);
          animation: pulseRing 4s ease-in-out infinite;
        }

        .ring-two {
          inset: 52px;
          border-color: rgba(45, 212, 191, 0.18);
          animation-delay: -2s;
        }

        @keyframes floatNode {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.22); }
        }

        @keyframes pulseRing {
          0%, 100% {
            opacity: 0.32;
            transform: scale(0.96);
          }
          50% {
            opacity: 0.78;
            transform: scale(1.02);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .advisor-node,
          .signal-ring {
            animation: none;
          }
        }

        @media (max-width: 860px) {
          .entry-page {
            place-items: start center;
            padding: 24px;
          }

          .entry-shell {
            min-height: auto;
            grid-template-columns: 1fr;
            gap: 34px;
          }

          .entry-copy {
            max-width: none;
          }

          .brand-link {
            margin-bottom: 28px;
          }

          .entry-board {
            width: min(420px, 100%);
            order: -1;
          }

          .advisor-node {
            --radius: 146px;
            width: 76px;
            height: 76px;
          }

          .advisor-node small {
            display: none;
          }

          .decision-core {
            width: 134px;
            height: 100px;
          }
        }

        @media (max-width: 520px) {
          .entry-page {
            padding: 18px;
          }

          .entry-copy h1 {
            font-size: 46px;
          }

          .entry-copy p {
            font-size: 16px;
          }

          .entry-actions {
            display: grid;
          }

          .entry-primary,
          .entry-secondary {
            width: 100%;
          }

          .advisor-node {
            --radius: 120px;
            width: 62px;
            height: 62px;
          }

          .advisor-node span {
            font-size: 20px;
          }
        }
      `}</style>
    </main>
  );
}
