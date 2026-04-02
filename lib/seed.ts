import { hashPassword } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";

interface SeedUser {
  username: string;
  password: string;
  role: "admin" | "tech" | "both";
}

const DEFAULT_USERS: SeedUser[] = [
  { username: "ignisia-admin", password: "admin123", role: "admin" },
  { username: "ignisia-tech", password: "tech123", role: "tech" },
  { username: "soham", password: "soham123", role: "both" },
];

export async function seedUsers(): Promise<boolean> {
  const { db } = await connectToDatabase();
  const usersCollection = db.collection("users");
  const existingUsers = await usersCollection.countDocuments({}, { limit: 1 });

  if (existingUsers > 0) {
    return false;
  }

  const usersWithHashedPasswords = await Promise.all(
    DEFAULT_USERS.map(async (user) => ({
      username: user.username,
      password: await hashPassword(user.password),
      role: user.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
  );

  await usersCollection.insertMany(usersWithHashedPasswords);

  return true;
}
