import { NextResponse } from "next/server";
import { getLocalAuthClient } from "@/lib/local-auth/server";
import {
  CREDIT_PACKS,
  FREE_SESSIONS_PER_MONTH,
  getOrCreateBillingAccount,
} from "@/lib/billing";

export async function GET() {
  try {
    const authClient = await getLocalAuthClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = getOrCreateBillingAccount(user.id, user.email ?? undefined);
    return NextResponse.json({
      account,
      freeTier: { sessionsPerMonth: FREE_SESSIONS_PER_MONTH },
      packs: Object.values(CREDIT_PACKS),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
