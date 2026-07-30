import { NextRequest, NextResponse } from "next/server";
import { createSessionToken } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  if (password !== sitePassword) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await createSessionToken(sitePassword);

  const response = NextResponse.json({ ok: true });
  response.cookies.set("f10_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
