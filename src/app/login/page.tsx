"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createLocalAuthClient } from "@/lib/local-auth/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/advisory";
  const errorParam = searchParams.get("error");
  const viewParam = searchParams.get("view");

  const [tab, setTab] = useState<"signin" | "signup">(
    viewParam === "signup" ? "signup" : "signin"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    errorParam === "auth_failed" ? "Authentication failed. Please try again." : null
  );
  const [message, setMessage] = useState<string | null>(null);

  const authClient = createLocalAuthClient();

  function switchTab(nextTab: "signin" | "signup") {
    setTab(nextTab);
    setError(null);
    setMessage(null);
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (tab === "signin") {
      const { error } = await authClient.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        router.push(next);
        router.refresh();
      }
    } else {
      const { error } = await authClient.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${next}` },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        setMessage("Check your email for a confirmation link.");
        setLoading(false);
      }
    }
  }

  async function handleGoogleOAuth() {
    setLoading(true);
    setError(null);
    const { error } = await authClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      background: "var(--background)",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: 28,
              letterSpacing: "-0.04em",
              color: "var(--text-primary)",
            }}>
              panely<span style={{ color: "var(--accent)" }}>.</span>
            </span>
          </Link>
          <p style={{ marginTop: 10, fontSize: 14, color: "var(--text-secondary)" }}>
            {tab === "signin" ? "Sign in to your account" : "Create a free account"}
          </p>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 32,
        }}>
          {/* Tabs */}
          <div style={{
            display: "flex",
            borderRadius: 8,
            border: "1px solid var(--border)",
            marginBottom: 28,
            overflow: "hidden",
          }}>
            {(["signin", "signup"] as const).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  fontSize: 13,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: tab === t ? "var(--accent)" : "transparent",
                  color: tab === t ? "#fff" : "var(--text-secondary)",
                  transition: "background 150ms ease, color 150ms ease",
                }}
              >
                {t === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          {/* Google OAuth */}
          <button
            onClick={handleGoogleOAuth}
            disabled={loading}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "11px 0",
              borderRadius: 8,
              border: "1px solid var(--border-strong)",
              background: "var(--surface-elevated)",
              color: "var(--text-primary)",
              fontSize: 14,
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              marginBottom: 20,
              opacity: loading ? 0.6 : 1,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.8 2.2 30.2 0 24 0 14.7 0 6.7 5.4 2.7 13.3l7.9 6.1C12.5 13 17.8 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h12.7c-.6 2.9-2.3 5.3-4.8 7l7.6 5.9c4.5-4.1 7-10.2 7-17.1z"/>
              <path fill="#FBBC05" d="M10.6 28.6A14.6 14.6 0 0 1 9.5 24c0-1.6.3-3.2.7-4.6L2.3 13.3A23.9 23.9 0 0 0 0 24c0 3.8.9 7.4 2.5 10.6l8.1-6z"/>
              <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.6-5.9c-2 1.4-4.7 2.2-7.6 2.2-6.2 0-11.5-4.2-13.4-9.8l-8.1 6C6.7 42.6 14.7 48 24 48z"/>
            </svg>
            {tab === "signin" ? "Continue with Google" : "Sign up with Google"}
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          {/* Email/Password form */}
          <form onSubmit={handleEmailAuth}>
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: "block",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginBottom: 6,
              }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-strong)",
                  background: "var(--surface-elevated)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: "block",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginBottom: 6,
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder={tab === "signup" ? "At least 8 characters" : "••••••••"}
                minLength={tab === "signup" ? 8 : undefined}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-strong)",
                  background: "var(--surface-elevated)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {error && (
              <div style={{
                marginBottom: 16,
                padding: "10px 12px",
                borderRadius: 8,
                background: "var(--negative-soft)",
                border: "1px solid rgba(255,69,58,0.3)",
                color: "var(--negative)",
                fontSize: 13,
              }}>
                {error}
              </div>
            )}

            {message && (
              <div style={{
                marginBottom: 16,
                padding: "10px 12px",
                borderRadius: 8,
                background: "var(--positive-soft)",
                border: "1px solid rgba(50,215,75,0.3)",
                color: "var(--positive)",
                fontSize: 13,
              }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px 0",
                borderRadius: 8,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? "Please wait…"
                : tab === "signin"
                ? "Sign in"
                : "Create account"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--text-muted)" }}>
          {tab === "signin" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => switchTab(tab === "signin" ? "signup" : "signin")}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent-hover)",
              fontSize: 13,
              cursor: "pointer",
              padding: 0,
            }}
          >
            {tab === "signin" ? "Sign up free" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
