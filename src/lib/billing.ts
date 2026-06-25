import fs from "fs";
import path from "path";

export type BillingTier = "free" | "pro";

export type BillingAccount = {
  userId: string;
  email?: string;
  tier: BillingTier;
  credits: number;
  freeSessionsUsedThisMonth: number;
  monthKey: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  updatedAt: string;
};

type BillingStore = {
  accounts: Record<string, BillingAccount>;
};

export const FREE_SESSIONS_PER_MONTH = 3;
const BILLING_DIR = path.join(process.cwd(), "data", "billing");
const BILLING_FILE = path.join(BILLING_DIR, "accounts.json");

export const CREDIT_PACKS = {
  starter_10: { id: "starter_10", name: "Starter Pack", credits: 10, amountCents: 900 },
  growth_25: { id: "growth_25", name: "Growth Pack", credits: 25, amountCents: 1900 },
  scale_60: { id: "scale_60", name: "Scale Pack", credits: 60, amountCents: 3900 },
} as const;

export type CreditPackId = keyof typeof CREDIT_PACKS;

function nowIso() {
  return new Date().toISOString();
}

function currentMonthKey() {
  const d = new Date();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${d.getUTCFullYear()}-${month}`;
}

function ensureStoreFile() {
  if (!fs.existsSync(BILLING_DIR)) {
    fs.mkdirSync(BILLING_DIR, { recursive: true });
  }
  if (!fs.existsSync(BILLING_FILE)) {
    const init: BillingStore = { accounts: {} };
    fs.writeFileSync(BILLING_FILE, JSON.stringify(init, null, 2));
  }
}

function readStore(): BillingStore {
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(BILLING_FILE, "utf-8");
    const parsed = JSON.parse(raw) as BillingStore;
    if (!parsed.accounts) return { accounts: {} };
    return parsed;
  } catch {
    return { accounts: {} };
  }
}

function writeStore(store: BillingStore) {
  ensureStoreFile();
  fs.writeFileSync(BILLING_FILE, JSON.stringify(store, null, 2));
}

function normalizeForCurrentMonth(account: BillingAccount): BillingAccount {
  const monthKey = currentMonthKey();
  if (account.monthKey === monthKey) return account;
  return {
    ...account,
    monthKey,
    freeSessionsUsedThisMonth: 0,
    updatedAt: nowIso(),
  };
}

export function getOrCreateBillingAccount(userId: string, email?: string): BillingAccount {
  const store = readStore();
  const existing = store.accounts[userId];
  const base: BillingAccount =
    existing ??
    {
      userId,
      email,
      tier: "free",
      credits: 0,
      freeSessionsUsedThisMonth: 0,
      monthKey: currentMonthKey(),
      updatedAt: nowIso(),
    };

  const normalized = normalizeForCurrentMonth({
    ...base,
    email: email ?? base.email,
  });

  store.accounts[userId] = normalized;
  writeStore(store);
  return normalized;
}

export function addCredits(userId: string, credits: number): BillingAccount {
  const store = readStore();
  const account = normalizeForCurrentMonth(
    store.accounts[userId] ??
      ({
        userId,
        tier: "free",
        credits: 0,
        freeSessionsUsedThisMonth: 0,
        monthKey: currentMonthKey(),
        updatedAt: nowIso(),
      } as BillingAccount)
  );

  account.credits = Math.max(0, account.credits + credits);
  account.updatedAt = nowIso();
  store.accounts[userId] = account;
  writeStore(store);
  return account;
}

export function attachStripeCustomer(userId: string, stripeCustomerId: string): BillingAccount {
  const store = readStore();
  const account = normalizeForCurrentMonth(
    store.accounts[userId] ??
      ({
        userId,
        tier: "free",
        credits: 0,
        freeSessionsUsedThisMonth: 0,
        monthKey: currentMonthKey(),
        updatedAt: nowIso(),
      } as BillingAccount)
  );
  const updated: BillingAccount = {
    ...account,
    stripeCustomerId,
    updatedAt: nowIso(),
  };
  store.accounts[userId] = updated;
  writeStore(store);
  return updated;
}

export function consumeSessionCredit(
  userId: string
): { ok: true; account: BillingAccount; mode: "free" | "credit" } | { ok: false; account: BillingAccount; reason: string } {
  const store = readStore();
  const account = normalizeForCurrentMonth(
    store.accounts[userId] ??
      ({
        userId,
        tier: "free",
        credits: 0,
        freeSessionsUsedThisMonth: 0,
        monthKey: currentMonthKey(),
        updatedAt: nowIso(),
      } as BillingAccount)
  );

  if (account.freeSessionsUsedThisMonth < FREE_SESSIONS_PER_MONTH) {
    account.freeSessionsUsedThisMonth += 1;
    account.updatedAt = nowIso();
    store.accounts[userId] = account;
    writeStore(store);
    return { ok: true, account, mode: "free" };
  }

  if (account.credits > 0) {
    account.credits -= 1;
    account.updatedAt = nowIso();
    store.accounts[userId] = account;
    writeStore(store);
    return { ok: true, account, mode: "credit" };
  }

  store.accounts[userId] = account;
  writeStore(store);
  return {
    ok: false,
    account,
    reason:
      "Free tier limit reached (3 sessions/month). Purchase credits to continue.",
  };
}
