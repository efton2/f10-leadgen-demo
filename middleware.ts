import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/session";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/proof/retrieve",   // ElevenLabs webhook — no session cookie
  "/api/cron/",            // Vercel cron — protected by CRON_SECRET header
  "/api/webhooks/resend",  // Resend webhook — protected by Svix signature
];
// NOTE: /api/receptionist and /api/ace-session were previously (incorrectly)
// public — the comment claiming "ElevenLabs session init, no session cookie"
// was wrong. Both are only ever called client-side from ReceptionistOrb.tsx
// and ProofStack.tsx, already running inside the logged-in browser session.
// ElevenLabs never calls these routes directly (it's the reverse — these
// routes call out to ElevenLabs), so the normal session-cookie check applies.

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get("f10_session");
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword) return NextResponse.next();

  const valid = await verifySessionToken(sessionCookie?.value, sitePassword);

  if (!valid) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
