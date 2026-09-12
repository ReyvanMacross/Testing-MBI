import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "../lib/project-env.mjs";

const MARKER="FIXTURE-KELURAHAN-MVP";
const RUN_SEED=Number(String(Date.now()).slice(-9));
async function client(){await loadProjectEnvironment();const{supabaseUrl,supabaseSecretKey}=getSupabaseAdminEnvironment();return createClient(supabaseUrl,supabaseSecretKey,{auth:{persistSession:false,autoRefreshToken:false}});}
async function expectResult(result){if(result.error)throw result.error;return result.data;}
function syntheticNumber(index,tail){return `32730${String(RUN_SEED*10+index*17+tail).padStart(11,"0")}`.slice(0,16);}

export async function cleanupKelurahanFixtures(){
  const db=await client();const citizens=await expectResult(await db.from("warga").select("id").eq("alamat_lengkap",MARKER));const citizenIds=(citizens??[]).map((row)=>row.id);
  if(!citizenIds.length)return{citizens:0,proposals:0,remaining:0};
  const local=await expectResult(await db.from("kelurahan_usulan").select("id,kecamatan_usulan_id").in("warga_id",citizenIds));const kecamatanIds=(local??[]).flatMap((row)=>row.kecamatan_usulan_id?[row.kecamatan_usulan_id]:[]);
  let referralIds=[];if(kecamatanIds.length){const details=await expectResult(await db.from("kecamatan_referral_details").select("referral_id").in("usulan_id",kecamatanIds));referralIds=(details??[]).map((row)=>row.referral_id);}
  await expectResult(await db.from("kelurahan_usulan").delete().in("warga_id",citizenIds));
  if(kecamatanIds.length)await expectResult(await db.from("kecamatan_warga_usulan").delete().in("id",kecamatanIds));
  if(referralIds.length)await expectResult(await db.from("referral_mbi").delete().in("id",referralIds));
  await expectResult(await db.from("warga").delete().in("id",citizenIds));
  const{count,error}=await db.from("warga").select("id",{count:"exact",head:true}).eq("alamat_lengkap",MARKER);if(error)throw error;if(count!==0)throw new Error(`${count} fixture warga Kelurahan masih tersisa.`);
  return{citizens:citizenIds.length,proposals:local?.length??0,remaining:0};
}

export async function seedKelurahanFixtures({demo=false}={}){
  await cleanupKelurahanFixtures();const db=await client();
  try{
    const actor=await expectResult(await db.from("user_profiles").select("id,wilayah_id,nama_lengkap").eq("username","admin.kelurahan").single());
    const village=await expectResult(await db.from("master_wilayah").select("id,nama,parent_id").eq("id",actor.wilayah_id).eq("jenis","KELURAHAN").single());
    const program=await expectResult(await db.from("master_program_layanan").select("id,nama_program,opd_id").eq("is_active",true).not("jalur","is",null).order("created_at").limit(1).single());
    const definitions=[
      ["waiting",demo?"Asep Saifuddin":"Uji Kelurahan Asep",1,"04","08"],
      ["ready",demo?"Siti Aminah":"Uji Kelurahan Siti",1,"04","08"],
      ["sent",demo?"Ratna Sari":"Uji Kelurahan Ratna",3,"01","03"],
    ];
    const state={actor,village,program,citizens:{},proposals:{},surveys:{}};
    for(const [key,name,desil,rt,rw] of definitions){
      const index=definitions.findIndex((row)=>row[0]===key);const citizen=await expectResult(await db.from("warga").insert({nik:syntheticNumber(index,2),nomor_kk:syntheticNumber(index,8),nama_lengkap:name,alamat_lengkap:MARKER,kelurahan:village.nama,kecamatan:"Sukajadi",kelurahan_id:village.id,kecamatan_id:village.parent_id,pekerjaan:"Pekerjaan fixture Kelurahan",jumlah_anggota_kk:4}).select("id,nik,nama_lengkap").single());state.citizens[key]=citizen;
      await expectResult(await db.from("penetapan_desil").insert({warga_id:citizen.id,desil_dtsen:desil,status_dtsen:"FIXTURE",tingkat_kerentanan:`DESIL_${desil}`,prioritas_intervensi:desil<=2?"TINGGI":"SEDANG"}));
      const proposal=await expectResult(await db.rpc("kelurahan_create_proposal",{p_actor_id:actor.id,p_warga_id:citizen.id,p_rt:rt,p_rw:rw,p_estimated_desil:desil,p_target_program_id:program.id,p_reason:"Warga memerlukan verifikasi faktual Kelurahan dan pengusulan layanan MBI yang sesuai hasil pendataan RT/RW.",p_is_fixture:true}));state.proposals[key]={id:proposal.proposalId,version:proposal.version};
      if(key==="waiting")continue;
      const assignment=await expectResult(await db.rpc("kelurahan_assign_survey",{p_proposal_id:proposal.proposalId,p_actor_id:actor.id,p_surveyor_profile_id:actor.id,p_surveyor_name:"Ahmad Supriadi (PSM Sekeloa)",p_instruction:"Lakukan verifikasi faktual kondisi fisik rumah, pekerjaan keluarga, dokumen, dan kelayakan usulan MBI.",p_expected_version:proposal.version}));state.proposals[key].version=assignment.version;state.surveys[key]={id:assignment.surveyId};
      const completed=await expectResult(await db.rpc("kelurahan_complete_survey",{p_survey_id:assignment.surveyId,p_actor_id:actor.id,p_score:key==="sent"?76:84,p_factual_desil:desil,p_notes:"Survei lapangan telah memastikan domisili, kondisi faktual, kelengkapan dokumen, dan kelayakan usulan warga.",p_expected_version:assignment.version}));state.proposals[key].version=completed.version;
      if(key==="sent"){const sent=await expectResult(await db.rpc("kelurahan_send_to_kecamatan",{p_proposal_id:proposal.proposalId,p_actor_id:actor.id,p_note:"Berkas diverifikasi Kasi Kesra Kelurahan dan diteruskan untuk review Kecamatan Sukajadi.",p_expected_version:state.proposals[key].version}));state.proposals[key].version=sent.version;state.proposals[key].kecamatanId=sent.kecamatanProposalId;}
    }
    return state;
  }catch(error){try{await cleanupKelurahanFixtures();}catch(cleanupError){throw new AggregateError([error,cleanupError],"Seed Kelurahan gagal dan cleanup juga gagal.");}throw error;}
}
