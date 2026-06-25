import { redirect } from "next/navigation";
import { getLocalAuthClient } from "@/lib/local-auth/server";
import {
  CREDIT_PACKS,
  FREE_SESSIONS_PER_MONTH,
  getOrCreateBillingAccount,
} from "@/lib/billing";
import CheckoutButton from "./CheckoutButton";

export default async function BillingPage() {
  const authClient = await getLocalAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect("/auth/signin?next=/billing");
  }

  const account = getOrCreateBillingAccount(user.id, user.email ?? undefined);
  const freeRemaining = Math.max(
    0,
    FREE_SESSIONS_PER_MONTH - account.freeSessionsUsedThisMonth
  );
  const packs = Object.values(CREDIT_PACKS);

  return (
    <main style={{ minHeight: "100vh", background: "var(--background)", padding: "64px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            Billing
          </h1>
          <a
            href="/profile"
            style={{ color: "var(--text-secondary)", fontSize: 14, textDecoration: "none" }}
          >
            Back to profile
          </a>
        </div>

        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 24,
            marginBottom: 20,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 14, fontSize: 18, color: "var(--text-primary)" }}>
            Usage
          </h2>
          <p style={{ margin: "0 0 8px 0", color: "var(--text-secondary)", fontSize: 14 }}>
            Free sessions remaining this month: <strong style={{ color: "var(--text-primary)" }}>{freeRemaining}</strong> / {FREE_SESSIONS_PER_MONTH}
          </p>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>
            Credit balance: <strong style={{ color: "var(--text-primary)" }}>{account.credits}</strong>
          </p>
        </section>

        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 14, fontSize: 18, color: "var(--text-primary)" }}>
            Buy Credits
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 14,
            }}
          >
            {packs.map((pack) => (
              <div
                key={pack.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 16,
                  background: "var(--surface-elevated)",
                }}
              >
                <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                  {pack.name}
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 12 }}>
                  {pack.credits} session credits
                </div>
                <div style={{ color: "var(--text-primary)", fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
                  ${(pack.amountCents / 100).toFixed(0)}
                </div>
                <CheckoutButton packId={pack.id} label={`Buy ${pack.credits} credits`} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
