import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnvironment, loadProjectEnvironment, PROJECT_ROOT } from "../lib/project-env.mjs";

const stateFile = path.join(PROJECT_ROOT, "artifacts", "dinsos", "fixture-state.json");
export async function client() { await loadProjectEnvironment(); const {supabaseUrl,supabaseSecretKey}=getSupabaseAdminEnvironment(); return createClient(supabaseUrl,supabaseSecretKey,{auth:{persistSession:false,autoRefreshToken:false}}); }

export async function cleanupDinsosFixtures() {
  const db=await client(); const {data,error}=await db.from("dinsos_cases").select("id").eq("is_fixture",true); if(error)throw error;
  if((data??[]).length>20)throw new Error(`Fixture cleanup guard: found ${data.length} cases.`);
  const caseIds=(data??[]).map(x=>x.id);
  const registryResult=caseIds.length?await db.from("dinsos_asesmen_sosial").select("registry_assessment_id").in("case_id",caseIds).not("registry_assessment_id","is",null):{data:[],error:null};if(registryResult.error)throw registryResult.error;
  if(data?.length){const {error:deleteError}=await db.from("dinsos_cases").delete().in("id",data.map(x=>x.id));if(deleteError)throw deleteError;}
  const registryIds=(registryResult.data??[]).map(x=>x.registry_assessment_id);if(registryIds.length){const {error:deleteAssessmentError}=await db.from("dinsos_assessments").delete().in("id",registryIds);if(deleteAssessmentError)throw deleteAssessmentError;}
  await rm(stateFile,{force:true}); return data?.length??0;
}

const validAssessment={status:"COMPLETED",rentang_pendapatan:"Konfigurasi lokal terverifikasi",status_bekerja:"TIDAK_BEKERJA",jenis_pekerjaan:null,penghasilan_bulanan:"Belum berpenghasilan",pendidikan_tertinggi:"SMA",literasi_digital:"CUKUP",penyakit_kronis_disabilitas:"TIDAK_ADA",penyakit_detail:null,balita_stunting:"TIDAK_ADA_BALITA",lansia_disabilitas_tanpa_pendamping:"TIDAK",anak_putus_sekolah_count:0,kelayakan_rumah:"LAYAK",air_sanitasi:"MEMADAI",nik_valid:true,kk_terbaru:true,bpjs_aktif:true,rekening_bank:false,motivasi_perubahan:4,keterampilan:"Keterampilan fixture lokal",catatan_petugas:null};

export async function seedDinsosFixtures() {
  const db=await client(); await cleanupDinsosFixtures();
  const {data:profile,error:profileError}=await db.from("user_profiles").select("id").eq("email","dinsos@bandung.go.id").single();if(profileError)throw profileError;
  const [{data:candidates,error},{data:activeCases,error:activeError}]=await Promise.all([db.from("v_warga_desil_current").select("warga_id,desil_dtsen").in("desil_dtsen",[1,2]).order("warga_id").limit(100),db.from("dinsos_cases").select("warga_id").is("closed_at",null).not("current_stage","in",'(SELESAI,DIBATALKAN)')]);if(error)throw error;if(activeError)throw activeError;const activeIds=new Set((activeCases??[]).map(row=>row.warga_id));const rows=(candidates??[]).filter(row=>!activeIds.has(row.warga_id)).slice(0,4);if(rows.length<3)throw new Error("Minimal tiga warga Desil 1/2 tanpa kasus aktif diperlukan untuk fixture Dinsos.");
  const definitions=[{key:"workflow",stage:"MENUNGGU_ASESMEN",priority:"TINGGI",warga:rows[0]},{key:"override",stage:"MENUNGGU_PENETAPAN_DESIL",priority:"SEDANG",warga:rows[1]},{key:"referral",stage:"STABILISASI_DIBUTUHKAN",priority:"TINGGI",warga:rows[2]}];
  const state={};
  for(const definition of definitions){const {data:caseRow,error:caseError}=await db.from("dinsos_cases").insert({warga_id:definition.warga.warga_id,current_stage:definition.stage,priority:definition.priority,assigned_to:profile.id,is_fixture:true}).select("id").single();if(caseError)throw caseError;state[definition.key]=caseRow.id;
    if(definition.key!=="workflow"){const {data:assessment,error:assessmentError}=await db.from("dinsos_asesmen_sosial").insert({case_id:caseRow.id,created_by:profile.id,completed_by:profile.id,completed_at:new Date().toISOString(),desil_dtsen_snapshot:definition.warga.desil_dtsen,pbi_snapshot:null,pkh_snapshot:null,bpnt_snapshot:null,...validAssessment,...(definition.key==="referral"?{score_kemiskinan:85,score_pekerjaan:70,score_pendidikan:90,score_kesehatan:60,score_kondisi_keluarga:30,score_tempat_tinggal:80,score_administrasi:65,score_kapasitas_individu:95}: {})}).select("id").single();if(assessmentError)throw assessmentError;
      if(definition.key==="referral"){const d=definition.warga.desil_dtsen;const {error:resultError}=await db.from("dinsos_case_results").insert({case_id:caseRow.id,assessment_id:assessment.id,status:"CONFIRMED",official_desil:d,operational_desil:d,disposition:"STABILISASI_SOSIAL",result_source:"SYSTEM",confirmed_by:profile.id,confirmed_at:new Date().toISOString()});if(resultError)throw resultError;}
    }
  }
  await mkdir(path.dirname(stateFile),{recursive:true});await writeFile(stateFile,JSON.stringify(state,null,2));return state;
}

export { validAssessment };
