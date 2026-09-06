import assert from "node:assert/strict";
import { client, cleanupDinsosFixtures, seedDinsosFixtures, validAssessment } from "./dev/dinsos-fixture-lib.mjs";

const db=await client();let state;
try{
  state=await seedDinsosFixtures();
  const {data:actor}=await db.from("user_profiles").select("id,opd_id").eq("email","dinsos@bandung.go.id").single();
  const {data:nonCap}=await db.from("user_profiles").select("id").eq("role","Admin Diskominfo").limit(1).single();
  const {data:workflowCase}=await db.from("dinsos_cases").select("warga_id").eq("id",state.workflow).single();
  const {data:officialBefore}=await db.from("penetapan_desil").select("desil_dtsen").eq("warga_id",workflowCase.warga_id).order("created_at",{ascending:false}).limit(1).single();
  const {error:draftError}=await db.from("dinsos_asesmen_sosial").insert({case_id:state.workflow,status:"DRAFT",created_by:actor.id});assert.equal(draftError,null,"Incomplete draft should be accepted");
  const incomplete=await db.rpc("dinsos_complete_assessment",{p_case_id:state.workflow,p_actor_id:actor.id});assert.ok(incomplete.error,"Incomplete completion must be rejected");
  const {error:updateError}=await db.from("dinsos_asesmen_sosial").update(validAssessment).eq("case_id",state.workflow);assert.equal(updateError,null);
  const complete=await db.rpc("dinsos_complete_assessment",{p_case_id:state.workflow,p_actor_id:actor.id});assert.equal(complete.error,null);assert.equal(complete.data.stage,"MENUNGGU_PENETAPAN_DESIL");
  const confirm=await db.rpc("dinsos_confirm_result",{p_case_id:state.workflow,p_actor_id:actor.id});assert.equal(confirm.error,null);assert.equal(confirm.data.stage,"STABILISASI_DIBUTUHKAN");
  const send=await db.rpc("dinsos_send_stabilization",{p_case_id:state.workflow,p_actor_id:actor.id,p_source_opd_id:actor.opd_id});assert.equal(send.error,null);assert.equal(send.data.stage,"MENUNGGU_STABILISASI");
  const duplicate=await db.rpc("dinsos_send_stabilization",{p_case_id:state.workflow,p_actor_id:actor.id,p_source_opd_id:actor.opd_id});assert.ok(duplicate.error,"Duplicate referral must be rejected");
  const denied=await db.rpc("dinsos_override_result",{p_case_id:state.override,p_actor_id:nonCap.id,p_new_desil:2,p_reason:"Alasan pengujian tanpa capability yang valid."});assert.ok(denied.error,"Override without capability must be rejected");
  const allowed=await db.rpc("dinsos_override_result",{p_case_id:state.override,p_actor_id:actor.id,p_new_desil:2,p_reason:"Alasan pengujian capability override yang terverifikasi."});assert.equal(allowed.error,null);
  const {data:officialAfter}=await db.from("penetapan_desil").select("desil_dtsen").eq("warga_id",workflowCase.warga_id).order("created_at",{ascending:false}).limit(1).single();assert.equal(officialAfter.desil_dtsen,officialBefore.desil_dtsen,"Official DTSEN must remain unchanged");
  const {data:auditRows,error:auditError}=await db.from("log_aktivitas").select("aktivitas,metadata").eq("modul","Dinas Sosial");assert.equal(auditError,null);for(const row of auditRows??[]){const serialized=JSON.stringify(row);assert.doesNotMatch(serialized,/\b\d{16}\b/,"Global audit must not contain a full NIK");assert.doesNotMatch(serialized,/nomor_kk|alamat|nomor_hp|penyakit|foto|catatan_petugas/i,"Global audit must not contain sensitive assessment fields");}
  const directTables=["dinsos_cases","dinsos_asesmen_sosial","dinsos_case_results","referral_mbi","user_capabilities"];
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;for(const table of directTables){const response=await fetch(`${url}/rest/v1/${table}?select=*&limit=1`,{headers:{apikey:key}});assert.ok([401,403].includes(response.status),`anon ${table} should be denied`);}
  console.log(JSON.stringify({draftIncomplete:"PASS",completeIncomplete:"REJECTED",completeValid:"PASS",officialDtsenUnchanged:"PASS",stabilizationReferral:"PASS",duplicateTransition:"BLOCKED",overrideWithoutCapability:"BLOCKED",overrideWithCapability:"PASS",auditPrivacy:"PASS",directAnon:"BLOCKED"},null,2));
}finally{await cleanupDinsosFixtures();}
