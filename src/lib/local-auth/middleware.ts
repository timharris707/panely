import { LOCAL_USER } from "@/lib/local-user";
import { NextResponse, type NextRequest } from "next/server";

export async function updateLocalSession(request: NextRequest) {
  return { user: LOCAL_USER, response: NextResponse.next({ request }) };
}
