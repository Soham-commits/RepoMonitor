import { seedUsers } from "@/lib/seed";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SEED_KEY = "ignistrack-seed-2026";

export async function GET(request: NextRequest) {
  const providedSeedKey = request.headers.get("x-seed-key");

  if (providedSeedKey !== SEED_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await seedUsers();

  return NextResponse.json({ seeded: true });
}
