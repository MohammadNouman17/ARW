import postgres from "postgres";

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  throw new Error("Missing POSTGRES_URL or DATABASE_URL environment variable.");
}

export const sql = postgres(connectionString, {
  ssl: "require",
  max: 1,
  idle_timeout: 20,
});

let ready;

export async function ensureSchema() {
  if (!ready) {
    ready = sql`
      CREATE TABLE IF NOT EXISTS people (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        mobile TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL DEFAULT '',
        cans INTEGER NOT NULL DEFAULT 0 CHECK (cans >= 0),
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `;
  }
  await ready;
}

export function rowToPerson(row) {
  return {
    id: Number(row.id),
    name: row.name,
    mobile: row.mobile || "",
    loc: row.location || "",
    cans: Number(row.cans || 0),
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
  };
}

export function sendJson(response, status, payload) {
  response.status(status).json(payload);
}

export function cleanText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function cleanCans(value) {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
