import { NextRequest, NextResponse } from "next/server";

interface MePayload {
  username: string;
  role: "admin" | "tech" | "both";
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get("ignistrack-token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const meResponse = await fetch(new URL("/api/auth/me", request.url), {
      method: "GET",
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    });

    if (!meResponse.ok) {
      throw new Error("Unauthorized");
    }

    const payload = (await meResponse.json()) as MePayload;

    if (pathname.startsWith("/admin/dashboard") && payload.role === "tech") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set("ignistrack-token", "", {
      path: "/",
      maxAge: 0,
    });
    return response;
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/dashboard/:path*"],
};
