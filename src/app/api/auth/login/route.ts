import { LOCAL_USER } from "@/lib/local-user";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const next = typeof body?.next === "string" ? body.next : "/advisory";

    return NextResponse.json({
      success: true,
      next,
      user: LOCAL_USER,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
