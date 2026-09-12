import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "../lib/project-env.mjs";

async function client() { await loadProjectEnvironment(); const { supabaseUrl, supabaseSecretKey }=getSupabaseAdminEnvironment(); return createClient(supabaseUrl,supabaseSecretKey,{auth:{persistSession:false,autoRefreshToken:false}}); }
async function checked(result) { if (result.error) throw result.error; return result.data; }

export async function cleanupWalikotaFixtures() {
  const db = await client();
  const recommendations = await checked(await db.from("bapperida_recommendations").select("id").like("reference_code", "DEV-WK-%").eq("is_fixture", true));
  if (recommendations.length > 8) throw new Error(`Fixture cleanup guard: ${recommendations.length} rekomendasi.`);
  if (recommendations.length) {
    await checked(await db.from("walikota_decisions").delete().in("recommendation_id", recommendations.map((row) => row.id)));
    await checked(await db.from("bapperida_recommendations").delete().in("id", recommendations.map((row) => row.id)).eq("is_fixture", true));
  }
  return { recommendations: recommendations.length };
}

export async function seedWalikotaFixtures() {
  await cleanupWalikotaFixtures();
  if (process.env.WALIKOTA_FIXTURE_TRACE === "true") console.log("walikota fixture: cleanup PASS");
  const db = await client();
  const [bapperidaActor, walikotaActor, opdRows] = await Promise.all([
    checked(await db.from("user_profiles").select("id,opd_id").eq("username", "admin.bapperida").single()),
    checked(await db.from("user_profiles").select("id,opd_id,role").eq("username", "admin.walikota").single()),
    checked(await db.from("master_opd").select("id,kode_opd").in("kode_opd", ["BAPPERIDA", "WALIKOTA", "DISNAKER", "DISKOP"])),
  ]);
  const byCode = new Map(opdRows.map((row) => [row.kode_opd, row.id]));
  if (process.env.WALIKOTA_FIXTURE_TRACE === "true") console.log("walikota fixture: actors PASS");
  if (bapperidaActor.opd_id !== byCode.get("BAPPERIDA")) throw new Error("Aktor fixture bukan BAPPERIDA.");
  if (walikotaActor.opd_id !== byCode.get("WALIKOTA") || walikotaActor.role !== "WALIKOTA") throw new Error("Aktor fixture bukan eksekutif WALIKOTA.");
  const saved = await checked(await db.rpc("bapperida_save_recommendation", {
    p_recommendation_id: null, p_expected_version: null, p_actor_id: bapperidaActor.id,
    p_actor_opd_id: bapperidaActor.opd_id, p_category: "SEBARAN_WILAYAH",
    p_finding: "Temuan fixture menunjukkan ketimpangan cakupan outcome antarkecamatan untuk keputusan eksekutif.",
    p_recommendation: "Prioritaskan koordinasi lintas perangkat daerah pada wilayah dengan konsentrasi Desil 1 dan 2.",
    p_recipient_opd_ids: [byCode.get("DISNAKER"), byCode.get("DISKOP")],
  }));
  if (process.env.WALIKOTA_FIXTURE_TRACE === "true") console.log("walikota fixture: draft PASS");
  await checked(await db.from("bapperida_recommendations").update({ reference_code: "DEV-WK-REC-01", is_fixture: true }).eq("id", saved.recommendationId));
  const submitted = await checked(await db.rpc("bapperida_submit_recommendation", {
    p_recommendation_id: saved.recommendationId, p_expected_version: saved.version,
    p_actor_id: bapperidaActor.id, p_actor_opd_id: bapperidaActor.opd_id,
  }));
  if (process.env.WALIKOTA_FIXTURE_TRACE === "true") console.log("walikota fixture: submit PASS");
  return { db, bapperidaActor, walikotaActor, recommendationId: saved.recommendationId, version: submitted.version, targetOpdIds: [byCode.get("DISNAKER"), byCode.get("DISKOP")] };
}
