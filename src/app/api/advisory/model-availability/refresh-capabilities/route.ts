import { NextResponse } from "next/server";
import { allowsLocalRefresh } from "@/lib/ai/local-refresh-request";
import { refreshProviderCapabilityCache } from "@/lib/ai/provider-capability-cache";

export async function POST(request: Request) {
  try {
    if (!allowsLocalRefresh(request)) {
      return NextResponse.json({ error: "Provider capability refresh requires a same-origin Panely request." }, { status: 403 });
    }

    const cache = await refreshProviderCapabilityCache();
    return NextResponse.json({ cache });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
