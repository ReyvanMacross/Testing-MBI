import { readFile } from "node:fs/promises";
import path from "node:path";

import pg from "pg";

import { PROJECT_ROOT } from "./project-env.mjs";

function parseEnvironment(content) {
  const values = new Map();
  for (const rawLine of content.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

export async function getStagingDatabaseUrl() {
  let databaseUrl = process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    const content = await readFile(path.join(PROJECT_ROOT, ".env.staging.local"), "utf8");
    databaseUrl = parseEnvironment(content).get("SUPABASE_DB_URL");
  }
  if (!databaseUrl?.startsWith("postgresql://")) {
    throw new Error("SUPABASE_DB_URL staging belum dikonfigurasi dengan URI PostgreSQL yang sah.");
  }
  return databaseUrl;
}

export async function withStagingDatabase(callback) {
  const connectionUrl = new URL(await getStagingDatabaseUrl());
  connectionUrl.searchParams.delete("sslmode");
  const client = new pg.Client({
    connectionString: connectionUrl.toString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
  });
  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}
