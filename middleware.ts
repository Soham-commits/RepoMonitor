import { NextRequest, NextResponse } from "next/server";

interface MePayload {
  username: string;
  role: "admin" | "tech" | "both";
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get("ignistrack-token")?.value;
  const isAdminDashboardRoute = pathname.startsWith("/admin/dashboard");
  const loginPath = isAdminDashboardRoute ? "/admin" : "/login";

  if (!token) {
    return NextResponse.redirect(new URL(loginPath, request.url));
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

    if (isAdminDashboardRoute && payload.role === "tech") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    if (pathname.startsWith("/dashboard") && payload.role === "admin") {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL(loginPath, request.url));
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
