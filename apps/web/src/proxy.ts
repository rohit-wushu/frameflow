import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only (no database here): signed-out visitors see the landing page at "/" and are
// sent to /login everywhere else. Every page and action still verifies the session itself (lib/auth.ts).
const PUBLIC = ["/login", "/signup", "/welcome"];

export function proxy(req: NextRequest) {
  const signedIn = req.cookies.has("ff_session");
  const path = req.nextUrl.pathname;
  if (!signedIn && path === "/") return NextResponse.rewrite(new URL("/welcome", req.url));
  if (!signedIn && !PUBLIC.includes(path)) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  // public/marketing holds the landing page's videos and images
  matcher: ["/((?!api/|_next/|marketing/|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|webp|ico|mp4|webm|woff2?)$).*)"],
};
