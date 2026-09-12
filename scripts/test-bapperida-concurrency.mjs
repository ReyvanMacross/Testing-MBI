import assert from "node:assert/strict";
import pg from "pg";

import { cleanupBapperidaFixtures, seedBapperidaFixtures } from "./dev/bapperida-fixture-lib.mjs";
import { getStagingDatabaseUrl } from "./lib/staging-database.mjs";

let pool;
try {
  const { db, actor, recommendationId, version, recipients } = await seedBapperidaFixtures();
  const connectionUrl = new URL(await getStagingDatabaseUrl());
  connectionUrl.searchParams.delete("sslmode");
  pool = new pg.Pool({
    connectionString: connectionUrl.toString(),
    ssl: { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 15_000,
  });
  const update = (suffix) => pool.query(
    "select public.bapperida_save_recommendation($1,$2,$3,$4,$5,$6,$7,$8::uuid[]) as result",
    [
      recommendationId,
      version,
      actor.id,
      actor.opd_id,
      "CAPAIAN_JALUR",
      `Temuan concurrency ${suffix} memiliki panjang yang valid untuk pengujian.`,
      `Rekomendasi concurrency ${suffix} memverifikasi optimistic locking lintas editor.`,
      recipients,
    ],
  );
  const results = await Promise.allSettled([update("A"), update("B")]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected" && String(result.reason?.message).includes("RECOMMENDATION_VERSION_CONFLICT")).length, 1);
  const row = await db.from("bapperida_recommendations").select("version").eq("id", recommendationId).single();
  if (row.error) throw row.error;
  assert.equal(row.data.version, version + 1);
  console.log("Concurrency BAPPERIDA: satu update menang dan satu version conflict PASS");
} finally {
  if (pool) await pool.end();
  await cleanupBapperidaFixtures();
}
