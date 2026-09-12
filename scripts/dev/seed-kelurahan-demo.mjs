import { createClient } from "@supabase/supabase-js";

import { seedKelurahanFixtures } from "./kelurahan-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "../lib/project-env.mjs";

await loadProjectEnvironment();
const{supabaseUrl,supabaseSecretKey}=getSupabaseAdminEnvironment();const db=createClient(supabaseUrl,supabaseSecretKey,{auth:{persistSession:false,autoRefreshToken:false}});
async function checked(result){if(result.error)throw result.error;return result.data;}
const existing=await checked(await db.from("warga").select("id").eq("alamat_lengkap","DEMO-KELURAHAN-MVP"));
if(existing.length===3){console.log("Data demo Kelurahan sudah tersedia; seed tidak diulang.");process.exit(0);}
if(existing.length)throw new Error("Data demo Kelurahan hanya terpasang sebagian.");
const state=await seedKelurahanFixtures({demo:true});const citizenIds=Object.values(state.citizens).map((row)=>row.id);const proposalIds=Object.values(state.proposals).map((row)=>row.id);const kecamatanIds=Object.values(state.proposals).flatMap((row)=>row.kecamatanId?[row.kecamatanId]:[]);
await checked(await db.from("warga").update({alamat_lengkap:"DEMO-KELURAHAN-MVP"}).in("id",citizenIds));
await checked(await db.from("kelurahan_usulan").update({is_fixture:false}).in("id",proposalIds));
await checked(await db.from("kelurahan_surveys").update({is_fixture:false}).in("usulan_id",proposalIds));
await checked(await db.from("kelurahan_documents").update({is_fixture:false}).in("usulan_id",proposalIds));
if(kecamatanIds.length){await checked(await db.from("kecamatan_warga_usulan").update({is_fixture:false}).in("id",kecamatanIds));await checked(await db.from("kecamatan_survei").update({is_fixture:false}).in("usulan_id",kecamatanIds));await checked(await db.from("kecamatan_documents").update({is_fixture:false}).in("usulan_id",kecamatanIds));}
console.log("Demo persisten Kelurahan: 3 usulan, survei, dokumen, dan handoff Kecamatan PASS");
