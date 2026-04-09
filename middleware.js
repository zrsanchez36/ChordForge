import { NextResponse } from "next/server";

const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const CHORDFORGE_SESSION_COOKIE = "chordforge_session";

export function middleware(request) {
  const response = NextResponse.next();

  if (!request.cookies.get(CHORDFORGE_SESSION_COOKIE)?.value) {
    response.cookies.set({
      name: CHORDFORGE_SESSION_COOKIE,
      value: crypto.randomUUID(),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
