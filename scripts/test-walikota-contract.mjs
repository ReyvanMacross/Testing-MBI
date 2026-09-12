import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";

const source = (file) => readFile(path.join(PROJECT_ROOT, file), "utf8");
const [foundation, rpcs, fixtureMigration, data, actor, input, api, audit, shell, mapExplorer] = await Promise.all([
  source("supabase/migrations/202609180001_walikota_executive_foundation.sql"),
  source("supabase/migrations/202609180002_walikota_executive_rpcs.sql"),
  source("supabase/migrations/202609180003_walikota_fixture_propagation.sql"),
  source("lib/walikota/data.ts"), source("lib/auth/require-walikota-actor.ts"),
  source("lib/walikota/input.ts"), source("app/api/walikota/recommendations/[id]/review/route.ts"),
  source("supabase/audits/walikota-final-schema-check.sql"),
  source("components/walikota/shell/walikota-shell.tsx"),
  source("components/diskominfo/peta-desil/penjelajah-peta-desil.tsx"),
]);
for (const table of ["walikota_decisions", "walikota_dispositions", "walikota_decision_events"]) { assert.ok(foundation.includes(`public.${table}`)); assert.ok(audit.includes(`'${table}'`)); }
for (const rpc of ["walikota_actor_allowed", "walikota_review_recommendation"]) { assert.ok(rpcs.includes(`public.${rpc}`)); assert.ok(rpcs.includes(`revoke all on function public.${rpc}`)); }
assert.match(foundation, /select \* from public\.bapperida_v_cross_opd_outcomes/u);
assert.match(rpcs, /profile\.role = 'WALIKOTA'/u);
assert.match(rpcs, /for update/u);
assert.match(rpcs, /RECOMMENDATION_VERSION_CONFLICT/u);
assert.match(fixtureMigration, /recommendation\.is_fixture/u);
assert.match(actor, /role: "WALIKOTA"/u);
assert.match(api, /requireWalikotaActor/u);
assert.match(api, /assertSameOrigin/u);
assert.match(input, /REQUEST_REVISION/u);
assert.match(data, /walikota_v_executive_outcomes/u);
assert.match(data, /bapperida_recommendations/u);
assert.match(mapExplorer, /basePath/u);
for (const route of ["/walikota", "/walikota/rekomendasi", "/walikota/keputusan"]) assert.ok(shell.includes(route));
assert.doesNotMatch(data, /\b\d{16}\b/u, "Data Wali Kota memuat NIK mentah.");
assert.doesNotMatch(foundation, /walikota_(?:warga|referral|program)/u, "Wali Kota menduplikasi data operasional.");
console.log("Kontrak executive actor, read model, keputusan RPC, concurrency, peta reuse, dan minimisasi data WALIKOTA: PASS");
