import { Db, MongoClient } from "mongodb";

interface MongoCache {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
}

declare global {
  var __mongoCache: MongoCache | undefined;
}

const globalForMongo = globalThis as typeof globalThis & {
  __mongoCache?: MongoCache;
};

const cache = globalForMongo.__mongoCache ?? {
  client: null,
  promise: null,
};

globalForMongo.__mongoCache = cache;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cache.client) {
    return { client: cache.client, db: cache.client.db() };
  }

  if (!cache.promise) {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGODB_URI is not set.");
    }

    const client = new MongoClient(uri);
    cache.promise = client.connect();
  }

  cache.client = await cache.promise;

  return { client: cache.client, db: cache.client.db() };
}
