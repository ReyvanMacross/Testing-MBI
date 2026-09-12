import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";
import { withStagingDatabase } from "./lib/staging-database.mjs";

const migrations=["202609190001_kelurahan_verification_foundation.sql","202609190002_kelurahan_verification_rpcs.sql","202609190003_kelurahan_final_hardening.sql","202609190004_kelurahan_kecamatan_handoff.sql"];
await withStagingDatabase(async(database)=>{const baseline=await database.query("select to_regclass('public.walikota_decisions') is not null as walikota, to_regclass('public.kecamatan_warga_usulan') is not null as kecamatan");if(Object.values(baseline.rows[0]).some((value)=>value!==true))throw new Error("Baseline 13 modul belum lengkap.");for(const migration of migrations){const sql=await readFile(path.join(PROJECT_ROOT,"supabase","migrations",migration),"utf8");await database.query("begin");try{await database.query(sql);await database.query("commit");console.log(`${migration}: PASS`);}catch(error){await database.query("rollback");throw new Error(`${migration}: GAGAL (${error.message})`,{cause:error});}}await database.query("notify pgrst, 'reload schema'");console.log("PostgREST schema reload: REQUESTED");});
