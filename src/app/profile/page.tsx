import { getLocalAuthClient } from "@/lib/local-auth/server";
import { redirect } from "next/navigation";
import SignOutButton from "./SignOutButton";

export default async function ProfilePage() {
  const authClient = await getLocalAuthClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  const joinedAt = new Date(user.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const provider = user.app_metadata?.provider ?? "email";

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--background)",
      padding: "80px 24px",
    }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 40, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/advisory" style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--text-secondary)",
            fontSize: 14,
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to advisory
          </a>
          <span style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
          }}>
            panely<span style={{ color: "var(--accent)" }}>.</span>
          </span>
        </div>

        <h1 style={{
          fontFamily: "var(--font-heading)",
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: "var(--text-primary)",
          marginBottom: 8,
        }}>
          Your account
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 32 }}>
          Manage your Panely account and preferences.
        </p>

        {/* Profile card */}
        <div style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          overflow: "hidden",
          marginBottom: 16,
        }}>
          {/* Avatar row */}
          <div style={{
            padding: "28px 28px 24px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            borderBottom: "1px solid var(--border)",
          }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1 0%, #a78bfa 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
              fontFamily: "var(--font-heading)",
            }}>
              {(user.email?.[0] ?? "?").toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                {user.user_metadata?.full_name ?? user.email}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                {user.email}
              </div>
            </div>
          </div>

          {/* Details */}
          <div style={{ padding: "20px 28px" }}>
            {[
              { label: "Account ID", value: user.id.slice(0, 16) + "…" },
              { label: "Sign-in method", value: provider === "google" ? "Google OAuth" : "Email / Password" },
              { label: "Member since", value: joinedAt },
            ].map(({ label, value }) => (
              <div key={label} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 0",
                borderBottom: "1px solid var(--border)",
              }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
                <span style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: label === "Account ID" ? "var(--font-mono)" : undefined }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sign out */}
        <div
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "20px 28px",
            marginBottom: 16,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              Billing
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Manage session credits and purchases.
            </div>
          </div>
          <a
            href="/billing"
            style={{
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--accent)",
            }}
          >
            Open billing
          </a>
        </div>

        {/* Sign out */}
        <div style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "24px 28px",
        }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
              Sign out
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              You will be signed out of this device.
            </div>
          </div>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
