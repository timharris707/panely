import { updateLocalSession } from "@/lib/local-auth/middleware";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { user, response } = await updateLocalSession(request);

  // Already logged in: skip login page
  if ((pathname === "/login" || pathname.startsWith("/auth/signin")) && user) {
    const next = request.nextUrl.searchParams.get("next") ?? "/advisory";
    const url = request.nextUrl.clone();
    url.pathname = next;
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
