import { NextResponse } from "next/server";
import { scanPublishSafety } from "@/lib/publish-safety";

export async function GET() {
  try {
    return NextResponse.json(scanPublishSafety());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
