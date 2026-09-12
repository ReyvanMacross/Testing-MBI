import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "../lib/project-env.mjs";

await loadProjectEnvironment();
const username=process.env.KELURAHAN_ADMIN_USERNAME||"admin.kelurahan";
const password=process.env.KELURAHAN_ADMIN_PASSWORD||process.env.SUPABASE_TEST_VILLAGE_PASSWORD||process.env.SUPABASE_TEST_ADMIN_PASSWORD;
assert.equal(username,"admin.kelurahan","Username staging Kelurahan harus admin.kelurahan.");
assert.ok(password&&password.length>=16,"Password staging Kelurahan minimal 16 karakter.");
const{supabaseUrl,supabaseSecretKey}=getSupabaseAdminEnvironment();
const admin=createClient(supabaseUrl,supabaseSecretKey,{auth:{persistSession:false,autoRefreshToken:false}});
const{data:village,error:villageError}=await admin.from("master_wilayah").select("id,nama,jenis,parent_id,is_active").eq("jenis","KELURAHAN").ilike("nama","Sekeloa").eq("is_active",true).single();
if(villageError||!village)throw villageError??new Error("Kelurahan Sekeloa tidak ditemukan.");
const email=["admin.kelurahan.sekeloa","staging.invalid"].join("@");let authUserId;
for(let page=1;page<=10&&!authUserId;page+=1){const{data,error}=await admin.auth.admin.listUsers({page,perPage:1000});if(error)throw error;authUserId=data.users.find((user)=>user.email?.toLowerCase()===email)?.id;if(data.users.length<1000)break;}
if(authUserId){const{error}=await admin.auth.admin.updateUserById(authUserId,{email,password,email_confirm:true});if(error)throw error;}else{const{data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error||!data.user)throw error??new Error("Auth user Kelurahan gagal dibuat.");authUserId=data.user.id;}
const{data:existing,error:existingError}=await admin.from("user_profiles").select("id").eq("username",username).maybeSingle();if(existingError)throw existingError;
const profile={email,nama_lengkap:"Admin Kelurahan Sekeloa",role:"Operator Kelurahan",wilayah_id:village.id,wilayah:`Kelurahan ${village.nama}`,instansi:`Kelurahan ${village.nama}`,auth_user_id:authUserId,status:"AKTIF"};
if(existing){const{error}=await admin.from("user_profiles").update(profile).eq("id",existing.id);if(error)throw error;}else{const{error}=await admin.from("user_profiles").insert({...profile,username});if(error)throw error;}
const publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;assert.ok(publishableKey,"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY wajib dikonfigurasi.");
const browser=createClient(supabaseUrl,publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});const verification=await browser.auth.signInWithPassword({email,password});if(verification.error||verification.data.user?.id!==authUserId)throw verification.error??new Error("Verifikasi login Kelurahan gagal.");await browser.auth.signOut({scope:"local"});
console.log("Admin Kelurahan Sekeloa berhasil di-onboard dan login terverifikasi.");
