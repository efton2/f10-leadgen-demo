import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/proof/retrieve",   // ElevenLabs webhook — no session cookie
  "/api/receptionist",     // ElevenLabs session init — no session cookie
  "/api/ace-session",      // ElevenLabs session — no session cookie
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get("f10_session");
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword) return NextResponse.next();

  const expectedToken = Buffer.from(sitePassword).toString("base64");

  if (!sessionCookie || sessionCookie.value !== expectedToken) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
