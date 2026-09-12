import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

import { cleanupKelurahanFixtures,seedKelurahanFixtures } from "./dev/kelurahan-fixture-lib.mjs";
import { getSupabaseAdminEnvironment,loadProjectEnvironment } from "./lib/project-env.mjs";

await loadProjectEnvironment();const{supabaseUrl,supabaseSecretKey}=getSupabaseAdminEnvironment();const db=createClient(supabaseUrl,supabaseSecretKey,{auth:{persistSession:false,autoRefreshToken:false}});let primaryError;
try{const state=await seedKelurahanFixtures();const ids=Object.values(state.proposals).map((row)=>row.id);const proposals=await db.from("kelurahan_usulan").select("id,status,kecamatan_usulan_id,version").in("id",ids);if(proposals.error)throw proposals.error;const byId=new Map(proposals.data.map((row)=>[row.id,row]));assert.equal(byId.get(state.proposals.waiting.id)?.status,"MENUNGGU_VERIFIKASI_RT_RW");assert.equal(byId.get(state.proposals.ready.id)?.status,"SIAP_DIKIRIM_KECAMATAN");assert.equal(byId.get(state.proposals.sent.id)?.status,"TERKIRIM_KECAMATAN");assert.ok(byId.get(state.proposals.sent.id)?.kecamatan_usulan_id);
  const linked=await db.from("kecamatan_warga_usulan").select("id,status,warga_id,kelurahan_id,kecamatan_id").eq("id",state.proposals.sent.kecamatanId).single();if(linked.error)throw linked.error;assert.equal(linked.data.status,"MENUNGGU_PERSETUJUAN");assert.equal(linked.data.warga_id,state.citizens.sent.id);assert.equal(linked.data.kelurahan_id,state.village.id);
  const survey=await db.from("kecamatan_survei").select("status,skor,desil_faktual").eq("usulan_id",linked.data.id).single();if(survey.error)throw survey.error;assert.equal(survey.data.status,"MENUNGGU_PERSETUJUAN");assert.equal(survey.data.skor,76);
  const integrity=await db.rpc("kelurahan_validate_domain_integrity");if(integrity.error)throw integrity.error;assert.deepEqual(integrity.data,{scopeMismatch:0,missingCreatedEvent:0,sentWithoutKecamatan:0,readyWithoutSurvey:0});console.log("Workflow Kelurahan dari usulan, survei, dokumen, hingga handoff Kecamatan: PASS");
}catch(error){primaryError=error;}finally{try{await cleanupKelurahanFixtures();}catch(cleanupError){if(!primaryError)primaryError=cleanupError;else console.error("Cleanup Kelurahan juga gagal:",cleanupError);}}if(primaryError)throw primaryError;
