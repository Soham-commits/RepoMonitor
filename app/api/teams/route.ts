import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface TeamRecord {
  teamId: string;
  teamName: string;
  psId: string;
  repoLink: string;
}

interface TeamsDocument {
  username: string;
  teams: TeamRecord[];
  updatedAt: Date;
}

interface TeamsBody {
  teams?: unknown;
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

function sanitizeTeams(value: unknown): TeamRecord[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const team = item as Partial<TeamRecord>;
      const teamId = typeof team.teamId === "string" ? team.teamId.trim() : "";
      const teamName = typeof team.teamName === "string" ? team.teamName.trim() : "";
      const psId = typeof team.psId === "string" ? team.psId.trim() : "";
      const repoLink = typeof team.repoLink === "string" ? team.repoLink.trim() : "";

      if (!teamId || !teamName || !psId || !repoLink) {
        return null;
      }

      return {
        teamId,
        teamName,
        psId,
        repoLink,
      };
    })
    .filter((team): team is TeamRecord => Boolean(team));
}

export async function GET(request: NextRequest) {
  const username = getUsernameFromRequest(request);

  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    const document = await db
      .collection<TeamsDocument>("teams")
      .findOne({ username }, { projection: { _id: 0, teams: 1 } });

    const teams = sanitizeTeams(document?.teams ?? []) ?? [];

    return NextResponse.json({ teams });
  } catch {
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const username = getUsernameFromRequest(request);

  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: TeamsBody;

  try {
    body = (await request.json()) as TeamsBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const teams = sanitizeTeams(body.teams);

  if (!teams) {
    return NextResponse.json({ error: "Invalid teams payload" }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();

    await db.collection<TeamsDocument>("teams").updateOne(
      { username },
      {
        $set: {
          username,
          teams,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save teams" }, { status: 500 });
  }
}
