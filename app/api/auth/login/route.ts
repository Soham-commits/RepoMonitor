import { comparePassword, signToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { seedUsers } from "@/lib/seed";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface LoginBody {
  username?: string;
  password?: string;
}

interface UserRecord {
  username: string;
  password: string;
  role: "admin" | "tech" | "both";
}

export async function POST(request: Request) {
  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const username = body.username?.trim();
  const password = body.password;

  if (!username || !password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await seedUsers();

  const { db } = await connectToDatabase();
  const user = await db.collection<UserRecord>("users").findOne({ username });

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const isValidPassword = await comparePassword(password, user.password);

  if (!isValidPassword) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = signToken({ username: user.username, role: user.role });

  const response = NextResponse.json({ success: true, role: user.role });
  response.cookies.set("ignistrack-token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return response;
}
