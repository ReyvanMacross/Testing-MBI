import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PROJECT_ROOT } from "./lib/project-env.mjs";

const source=(file)=>readFile(path.join(PROJECT_ROOT,file),"utf8");
const [foundation,rpcs,data,actor,mapExplorer,mapDistrict,mapSubdistrict,api,audit,shell]=await Promise.all([
  source("supabase/migrations/202609170001_bapperida_coordination_foundation.sql"),source("supabase/migrations/202609170002_bapperida_coordination_rpcs.sql"),source("lib/bapperida/data.ts"),source("lib/auth/require-bapperida-actor.ts"),source("components/diskominfo/peta-desil/penjelajah-peta-desil.tsx"),source("components/diskominfo/peta-desil/peta-kecamatan-bandung.tsx"),source("components/diskominfo/peta-desil/peta-kelurahan-bandung.tsx"),source("app/api/bapperida/recommendations/route.ts"),source("supabase/audits/bapperida-final-schema-check.sql"),source("components/bapperida/shell/bapperida-shell.tsx")]);
for(const table of ["bapperida_indicator_targets","bapperida_evaluation_snapshots","bapperida_recommendations","bapperida_recommendation_recipients","bapperida_recommendation_events"]){assert.ok(foundation.includes(`public.${table}`));assert.ok(audit.includes(`'${table}'`));}
for(const rpc of ["bapperida_save_recommendation","bapperida_submit_recommendation","bapperida_publish_evaluation_snapshot"]){assert.ok(rpcs.includes(`public.${rpc}`));assert.ok(rpcs.includes(`revoke all on function public.${rpc}`));}
assert.match(foundation,/bapperida_v_cross_opd_outcomes/u);assert.match(foundation,/from public\.referral_mbi referral/u);assert.match(foundation,/join public\.warga warga/u);assert.match(rpcs,/for update/u);assert.match(rpcs,/RECOMMENDATION_VERSION_CONFLICT/u);assert.match(actor,/opdCode: "BAPPERIDA"/u);assert.match(api,/requireBapperidaActor/u);assert.match(data,/bapperida_v_cross_opd_outcomes/u);assert.match(mapExplorer,/basePath/u);assert.match(mapDistrict,/basePath/u);assert.match(mapSubdistrict,/basePath/u);for(const route of ["/bapperida","/bapperida/laporan","/bapperida/rekomendasi"])assert.ok(shell.includes(route));assert.doesNotMatch(data,/\b\d{16}\b/u,"Data Bapperida memuat NIK mentah.");
console.log("Kontrak source, read model, RPC, concurrency, peta reuse, dan masking BAPPERIDA: PASS");
