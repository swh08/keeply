import { type NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const locale = request.nextUrl.pathname.startsWith("/en/") ? "en" : "zh-CN";
  return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
}

export const config = { matcher: ["/:locale(zh-CN|en)/(app/:path*|onboarding)"] };
