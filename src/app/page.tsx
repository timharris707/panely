import Link from "next/link";

// ─── Icons (inline SVG to avoid bundle dependency) ───────────────────────────

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.22 4.22l1.41 1.41M12.37 12.37l1.41 1.41M4.22 13.78l1.41-1.41M12.37 5.63l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

// ─── Noise overlay for texture ────────────────────────────────────────────────

function NoiseOverlay() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        opacity: 0.025,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        backgroundSize: "200px 200px",
      }}
    />
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      borderBottom: "1px solid var(--border)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      backgroundColor: "rgba(12,12,12,0.85)",
    }}>
      <div style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "0 24px",
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: "-0.03em",
          color: "var(--text-primary)",
        }}>
          panely<span style={{ color: "var(--accent)" }}>.</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link
            href="/auth/signin"
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--text-secondary)",
              textDecoration: "none",
              padding: "8px 14px",
              borderRadius: "var(--radius-md)",
              transition: "color 150ms ease",
            }}
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="btn-primary"
            style={{ fontSize: 14, padding: "8px 18px" }}
          >
            Start free
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section style={{
      paddingTop: 160,
      paddingBottom: 100,
      paddingLeft: 24,
      paddingRight: 24,
      textAlign: "center",
      position: "relative",
    }}>
      {/* Radial glow */}
      <div aria-hidden style={{
        position: "absolute",
        top: 80,
        left: "50%",
        transform: "translateX(-50%)",
        width: 600,
        height: 400,
        background: "radial-gradient(ellipse at center, rgba(99,102,241,0.15) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 780, margin: "0 auto", position: "relative" }}>
        {/* Eyebrow badge */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 12px",
          borderRadius: 999,
          border: "1px solid rgba(99,102,241,0.35)",
          backgroundColor: "rgba(99,102,241,0.08)",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--accent-hover)",
          marginBottom: 32,
        }}>
          <IconSparkle />
          AI Advisory Board
        </div>

        <h1 style={{
          fontFamily: "var(--font-heading)",
          fontSize: "clamp(42px, 6vw, 72px)",
          fontWeight: 700,
          lineHeight: 1.08,
          letterSpacing: "-0.04em",
          color: "var(--text-primary)",
          marginBottom: 24,
        }}>
          Your toughest decisions{" "}
          <span style={{
            background: "linear-gradient(135deg, #818cf8 0%, #6366f1 50%, #a78bfa 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            deserve a real board.
          </span>
        </h1>

        <p style={{
          fontSize: "clamp(16px, 2vw, 20px)",
          lineHeight: 1.6,
          color: "var(--text-secondary)",
          maxWidth: 560,
          margin: "0 auto 44px",
        }}>
          Submit any decision. Panely assembles a panel of AI advisors who debate from competing perspectives — then delivers a premium Board Brief you can act on.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/advisory"
            className="btn-primary"
            style={{ fontSize: 16, padding: "14px 28px" }}
          >
            Get your Board Brief <IconArrow />
          </Link>
          <a
            href="#how-it-works"
            className="btn-outline"
            style={{ fontSize: 16, padding: "14px 28px" }}
          >
            See how it works
          </a>
        </div>

        <p style={{
          marginTop: 20,
          fontSize: 13,
          color: "var(--text-muted)",
        }}>
          Free — 3 sessions per month. No credit card required.
        </p>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    number: "01",
    title: "Submit your decision",
    body: "Describe the decision you're facing — a product bet, a hire, a strategy pivot, a pricing change. The more context you give, the sharper the advice.",
    accent: "#6366f1",
  },
  {
    number: "02",
    title: "Your board deliberates",
    body: "Panely assembles a panel of AI advisors — each playing a distinct role: skeptic, optimist, analyst, operator. They debate your decision in real time.",
    accent: "#818cf8",
  },
  {
    number: "03",
    title: "Receive your Board Brief",
    body: "A structured executive document lands with the panel's consensus, dissents, key risks, recommended actions, and open questions. Ready to share or archive.",
    accent: "#a78bfa",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" style={{
      padding: "100px 24px",
      maxWidth: 1100,
      margin: "0 auto",
    }}>
      <div style={{ textAlign: "center", marginBottom: 64 }}>
        <h2 style={{
          fontFamily: "var(--font-heading)",
          fontSize: "clamp(28px, 4vw, 44px)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "var(--text-primary)",
          marginBottom: 16,
        }}>
          How it works
        </h2>
        <p style={{ fontSize: 17, color: "var(--text-secondary)", maxWidth: 460, margin: "0 auto" }}>
          From question to Board Brief in minutes.
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 24,
      }}>
        {STEPS.map((step) => (
          <div
            key={step.number}
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: 32,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Step number watermark */}
            <div style={{
              position: "absolute",
              top: -12,
              right: 16,
              fontFamily: "var(--font-heading)",
              fontSize: 80,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: "rgba(255,255,255,0.03)",
              lineHeight: 1,
              userSelect: "none",
            }}>
              {step.number}
            </div>

            <div style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(99,102,241,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
              fontSize: 13,
              fontWeight: 700,
              color: step.accent,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.02em",
            }}>
              {step.number}
            </div>

            <h3 style={{
              fontFamily: "var(--font-heading)",
              fontSize: 18,
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 10,
              letterSpacing: "-0.02em",
            }}>
              {step.title}
            </h3>
            <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text-secondary)" }}>
              {step.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Board Brief Preview ──────────────────────────────────────────────────────

function BriefPreview() {
  return (
    <section style={{ padding: "80px 24px", position: "relative" }}>
      {/* Background accent */}
      <div aria-hidden style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(180deg, transparent 0%, rgba(99,102,241,0.04) 50%, transparent 100%)",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 860, margin: "0 auto", position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            marginBottom: 16,
          }}>
            What a Board Brief looks like
          </h2>
          <p style={{ fontSize: 17, color: "var(--text-secondary)" }}>
            A real output from a real session — redacted for privacy.
          </p>
        </div>

        {/* Mock brief card */}
        <div style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}>
          {/* Brief header */}
          <div style={{
            padding: "24px 32px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}>
            <div>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--accent)",
                marginBottom: 6,
                fontFamily: "var(--font-mono)",
              }}>
                Board Brief · Session #47
              </div>
              <h3 style={{
                fontFamily: "var(--font-heading)",
                fontSize: 20,
                fontWeight: 600,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
                margin: 0,
              }}>
                Should we launch a free tier or stay enterprise-only?
              </h3>
            </div>
            <div style={{
              padding: "4px 10px",
              borderRadius: 999,
              backgroundColor: "rgba(50,215,75,0.1)",
              border: "1px solid rgba(50,215,75,0.2)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "#32D74B",
              whiteSpace: "nowrap",
            }}>
              Complete
            </div>
          </div>

          {/* Consensus block */}
          <div style={{
            padding: "24px 32px",
            borderBottom: "1px solid var(--border)",
            backgroundColor: "rgba(99,102,241,0.04)",
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 10,
            }}>
              Panel Consensus
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--text-primary)", margin: 0 }}>
              The board recommends a <strong style={{ color: "var(--accent-hover)" }}>limited free tier</strong> with a hard 3-session cap. The upside from bottom-up adoption outweighs the revenue dilution risk, provided pricing protects the high-touch enterprise motion. Launch in Q3 with a waitlist to manage server costs.
            </p>
          </div>

          {/* Two column: voices + actions */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 0,
          }}>
            {/* Advisor voices */}
            <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border)" }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: 16,
              }}>
                Advisor Voices
              </div>
              {[
                { name: "Strategist", view: "Free tier creates a moat. PLG compounds faster than enterprise sales.", color: "#818cf8" },
                { name: "Skeptic", view: "Free users burn infra budget. Define clear conversion triggers before launch.", color: "#f59e0b" },
                { name: "Operator", view: "Onboarding for free users must be zero-touch — we don't have the CS capacity.", color: "#34d399" },
              ].map((a) => (
                <div key={a.name} style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    backgroundColor: `${a.color}22`,
                    border: `1px solid ${a.color}44`,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    color: a.color,
                  }}>
                    {a.name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>
                      {a.name}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-secondary)" }}>
                      {a.view}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recommended actions */}
            <div style={{ padding: "24px 32px", borderLeft: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: 16,
              }}>
                Recommended Actions
              </div>
              {[
                "Cap free tier at 3 sessions/month with clear upgrade prompts",
                "Build zero-touch onboarding before any public launch",
                "Define conversion trigger: 2nd session completion → upgrade nudge",
                "Set server cost ceiling at $X/free-user before pausing signups",
              ].map((action, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    backgroundColor: "rgba(99,102,241,0.15)",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--accent)",
                    marginTop: 1,
                  }}>
                    <IconCheck />
                  </div>
                  <span style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-secondary)" }}>{action}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: "16px 32px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>4 advisors · 23 exchanges · 8 min</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>Exportable as PDF · Shareable link</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    tagline: "Try it out. No commitment.",
    features: [
      "3 Board Brief sessions / month",
      "Standard 4-advisor panel",
      "PDF export",
      "Shareable links",
    ],
    cta: "Start free",
    ctaHref: "/advisory",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "per month",
    tagline: "For founders and operators moving fast.",
    features: [
      "Unlimited Board Brief sessions",
      "Custom advisor panels (up to 8)",
      "Markdown + PDF + CSV export",
      "Session archive and search",
      "Priority processing",
    ],
    cta: "Start Pro",
    ctaHref: "/advisory",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "per seat",
    tagline: "For teams that need governance and scale.",
    features: [
      "Everything in Pro",
      "Team workspace + shared archive",
      "SSO / SAML",
      "Custom advisor personas",
      "Dedicated support",
    ],
    cta: "Talk to us",
    ctaHref: "mailto:hello@panely.ai",
    highlight: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" style={{ padding: "100px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h2 style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            marginBottom: 16,
          }}>
            Simple pricing
          </h2>
          <p style={{ fontSize: 17, color: "var(--text-secondary)" }}>
            Start free. Upgrade when you need more.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 24,
          alignItems: "stretch",
        }}>
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              style={{
                backgroundColor: plan.highlight ? "var(--surface-elevated)" : "var(--surface)",
                border: plan.highlight ? "1px solid var(--accent)" : "1px solid var(--border)",
                borderRadius: 16,
                padding: 32,
                display: "flex",
                flexDirection: "column",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {plan.highlight && (
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: "linear-gradient(90deg, #6366f1, #818cf8, #a78bfa)",
                }} />
              )}

              {plan.highlight && (
                <div style={{
                  position: "absolute",
                  top: 16,
                  right: 20,
                  padding: "3px 8px",
                  borderRadius: 999,
                  backgroundColor: "rgba(99,102,241,0.2)",
                  border: "1px solid rgba(99,102,241,0.4)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--accent-hover)",
                }}>
                  Most popular
                </div>
              )}

              <div style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: plan.highlight ? "var(--accent)" : "var(--text-secondary)",
                  marginBottom: 8,
                  letterSpacing: "0.02em",
                }}>
                  {plan.name}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
                  <span style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: 40,
                    fontWeight: 700,
                    letterSpacing: "-0.04em",
                    color: "var(--text-primary)",
                  }}>
                    {plan.price}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {plan.period}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                  {plan.tagline}
                </p>
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", flexGrow: 1 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    marginBottom: 10,
                    fontSize: 14,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}>
                    <span style={{ color: "var(--positive)", marginTop: 1, flexShrink: 0 }}>
                      <IconCheck />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.ctaHref}
                className={plan.highlight ? "btn-primary" : "btn-outline"}
                style={{ textAlign: "center", fontSize: 15 }}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section style={{ padding: "80px 24px 120px", textAlign: "center", position: "relative" }}>
      <div aria-hidden style={{
        position: "absolute",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: 700,
        height: 300,
        background: "radial-gradient(ellipse at center bottom, rgba(99,102,241,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 640, margin: "0 auto", position: "relative" }}>
        <h2 style={{
          fontFamily: "var(--font-heading)",
          fontSize: "clamp(32px, 5vw, 54px)",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: "var(--text-primary)",
          lineHeight: 1.1,
          marginBottom: 20,
        }}>
          Make better decisions,{" "}
          <span style={{
            background: "linear-gradient(135deg, #818cf8 0%, #6366f1 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            starting today.
          </span>
        </h2>
        <p style={{
          fontSize: 18,
          color: "var(--text-secondary)",
          marginBottom: 40,
          lineHeight: 1.6,
        }}>
          Your first three Board Briefs are free. No credit card, no onboarding call, no fluff.
        </p>

        <Link
          href="/advisory"
          className="btn-primary"
          style={{ fontSize: 17, padding: "16px 36px" }}
        >
          Get your Board Brief <IconArrow />
        </Link>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{
      borderTop: "1px solid var(--border)",
      padding: "28px 24px",
    }}>
      <div style={{
        maxWidth: 1100,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <span style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: 15,
          color: "var(--text-muted)",
          letterSpacing: "-0.02em",
        }}>
          panely<span style={{ color: "var(--accent)" }}>.</span>
        </span>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          © 2026 Panely. AI-powered deliberation.
        </span>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <>
      <NoiseOverlay />
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <BriefPreview />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
