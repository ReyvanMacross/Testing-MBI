import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "../lib/project-env.mjs";

async function client(){await loadProjectEnvironment();const {supabaseUrl,supabaseSecretKey}=getSupabaseAdminEnvironment();return createClient(supabaseUrl,supabaseSecretKey,{auth:{persistSession:false,autoRefreshToken:false}});}
async function checked(result){if(result.error)throw result.error;return result.data;}

export async function cleanupBapperidaFixtures(){
  const db=await client();
  const recommendations=await checked(await db.from("bapperida_recommendations").select("id").like("reference_code","DEV-BAP-%").eq("is_fixture",true));
  if(recommendations.length>8)throw new Error(`Fixture cleanup guard: ${recommendations.length} rekomendasi.`);
  if(recommendations.length)await checked(await db.from("bapperida_recommendations").delete().in("id",recommendations.map((row)=>row.id)).eq("is_fixture",true));
  const snapshots=await checked(await db.from("bapperida_evaluation_snapshots").select("id").like("source_digest","DEV-BAPPERIDA-%").eq("is_fixture",true));
  if(snapshots.length>4)throw new Error(`Fixture cleanup guard: ${snapshots.length} snapshot.`);
  if(snapshots.length)await checked(await db.from("bapperida_evaluation_snapshots").delete().in("id",snapshots.map((row)=>row.id)).eq("is_fixture",true));
  return {recommendations:recommendations.length,snapshots:snapshots.length};
}

export async function seedBapperidaFixtures(){
  await cleanupBapperidaFixtures();const db=await client();
  const actor=await checked(await db.from("user_profiles").select("id,opd_id").eq("username","admin.bapperida").single());
  const opds=await checked(await db.from("master_opd").select("id,kode_opd").in("kode_opd",["DISNAKER","DISKOP","BAPPERIDA"]));
  const byCode=new Map(opds.map((row)=>[row.kode_opd,row.id]));
  if(actor.opd_id!==byCode.get("BAPPERIDA"))throw new Error("Aktor fixture bukan BAPPERIDA.");
  const saved=await checked(await db.rpc("bapperida_save_recommendation",{p_recommendation_id:null,p_expected_version:null,p_actor_id:actor.id,p_actor_opd_id:actor.opd_id,p_category:"CAPAIAN_JALUR",p_finding:"Temuan fixture memperlihatkan kesenjangan capaian jalur untuk pengujian.",p_recommendation:"Rekomendasi fixture menguji koordinasi dua perangkat daerah secara transaksional.",p_recipient_opd_ids:[byCode.get("DISNAKER"),byCode.get("DISKOP")]}));
  await checked(await db.from("bapperida_recommendations").update({reference_code:"DEV-BAP-REC-01",is_fixture:true}).eq("id",saved.recommendationId));
  await checked(await db.from("bapperida_evaluation_snapshots").insert({period:"2099-09-01",independent_citizens:10,program_success_rate:60,reentry_citizens:2,welfare_index:70,path_distribution:{PEKERJA:40,WIRAUSAHA:30,PENGUATAN_DASAR:20,AKSELERASI_SEKTORAL:10},desil_distribution:{D1:20,D2:30,D3:25,D4:15,D5:10},source_digest:"DEV-BAPPERIDA-SNAPSHOT-01",status:"PUBLISHED",published_at:new Date().toISOString(),is_fixture:true,created_by:actor.id}));
  return {db,actor,recommendationId:saved.recommendationId,version:saved.version,recipients:[byCode.get("DISNAKER"),byCode.get("DISKOP")]};
}
