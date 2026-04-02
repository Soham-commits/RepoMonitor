import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface PatDocument {
  username: string;
  pat: string;
  updatedAt: Date;
}

interface PatBody {
  pat?: unknown;
}

function getUsernameFromRequest(request: NextRequest): string | null {
  const token = request.cookies.get("ignistrack-token")?.value;

  if (!token) {
    return null;
  }

  try {
    return verifyToken(token).username;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const username = getUsernameFromRequest(request);

  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    const document = await db
      .collection<PatDocument>("pats")
      .findOne({ username }, { projection: { _id: 0, pat: 1 } });

    return NextResponse.json({ pat: typeof document?.pat === "string" ? document.pat : null });
  } catch {
    return NextResponse.json({ error: "Failed to fetch PAT" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const username = getUsernameFromRequest(request);

  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PatBody;

  try {
    body = (await request.json()) as PatBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof body.pat !== "string") {
    return NextResponse.json({ error: "Invalid PAT payload" }, { status: 400 });
  }

  const pat = body.pat.trim();

  try {
    const { db } = await connectToDatabase();

    await db.collection<PatDocument>("pats").updateOne(
      { username },
      {
        $set: {
          username,
          pat,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save PAT" }, { status: 500 });
  }
}
