import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

const pgHost = process.env.PGHOST;
const pgPort = process.env.PGPORT;
const pgUser = process.env.PGUSER;
const pgPassword = process.env.PGPASSWORD;
const pgDatabase = process.env.PGDATABASE;

// For development, allow running without database (using in-memory storage)
const USE_DATABASE = pgHost && pgPort && pgUser && pgPassword && pgDatabase;

let db: ReturnType<typeof drizzle> | null = null;

if (USE_DATABASE) {
const connectionString = `postgres://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}?sslmode=require`;
const client = postgres(connectionString);
  db = drizzle({ client, schema });
} else {
  console.warn("⚠️  Database credentials not configured. Using in-memory storage only.");
  console.warn("   Some features (audit logs, usage metrics) will use in-memory storage.");
}

export { db };
