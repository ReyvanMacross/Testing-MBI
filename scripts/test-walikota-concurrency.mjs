import assert from "node:assert/strict";
import pg from "pg";

import { cleanupWalikotaFixtures, seedWalikotaFixtures } from "./dev/walikota-fixture-lib.mjs";
import { getStagingDatabaseUrl } from "./lib/staging-database.mjs";

let pool;
try {
  const { db, walikotaActor, recommendationId, version } = await seedWalikotaFixtures();
  const connectionUrl = new URL(await getStagingDatabaseUrl());
  connectionUrl.searchParams.delete("sslmode");
  pool = new pg.Pool({ connectionString: connectionUrl.toString(), ssl: { rejectUnauthorized: false }, max: 2, connectionTimeoutMillis: 15_000 });
  const review = (suffix) => pool.query(
    "select public.walikota_review_recommendation($1,$2,$3,$4,$5,$6,$7,$8::jsonb) as result",
    [recommendationId, version, walikotaActor.id, walikotaActor.opd_id, suffix === "A" ? "APPROVE" : "REQUEST_REVISION", "TINGGI", `Catatan concurrency ${suffix} memverifikasi satu keputusan eksekutif per versi rekomendasi.`, "[]"],
  );
  const results = await Promise.allSettled([review("A"), review("B")]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected" && /(?:VERSION_CONFLICT|NOT_REVIEWABLE)/u.test(String(result.reason?.message))).length, 1);
  const rows = await db.from("walikota_decisions").select("id").eq("recommendation_id", recommendationId);
  if (rows.error) throw rows.error;
  assert.equal(rows.data.length, 1);
  console.log("Concurrency WALIKOTA: satu keputusan menang dan satu konflik status/versi PASS");
} finally { if (pool) await pool.end(); await cleanupWalikotaFixtures(); }
