import { NextResponse } from "next/server";
import { checkPasscode, createSessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const { passcode } = (await req.json().catch(() => ({}))) as {
    passcode?: string;
  };

  if (!passcode || !checkPasscode(passcode)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const token = await createSessionToken(30);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
