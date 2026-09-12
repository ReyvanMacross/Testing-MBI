import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "../lib/project-env.mjs";

await loadProjectEnvironment();
const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const db = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
async function checked(result) { if (result.error) throw result.error; return result.data; }

const actor = await checked(await db.from("user_profiles").select("id,opd_id,role").eq("username", "admin.walikota").single());
if (actor.role !== "WALIKOTA") throw new Error("Akun demo Wali Kota bukan actor eksekutif.");
const [recommendations, opds] = await Promise.all([
  checked(await db.from("bapperida_recommendations").select("id,reference_code,version,status").in("reference_code", ["DEMO-BAP-REC-02", "DEMO-BAP-REC-03"])),
  checked(await db.from("master_opd").select("id,kode_opd").in("kode_opd", ["DINSOS", "DISNAKER", "DISKOP"])),
]);
const recommendationMap = new Map(recommendations.map((row) => [row.reference_code, row]));
const opdMap = new Map(opds.map((row) => [row.kode_opd, row.id]));
const demoDueDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
for (const row of recommendations) {
  const existing = await checked(await db.from("walikota_decisions").select("id").eq("recommendation_id", row.id).eq("is_fixture", false));
  if (existing.length) await checked(await db.from("walikota_decisions").delete().in("id", existing.map((item) => item.id)).eq("is_fixture", false));
}
const revisionSource = recommendationMap.get("DEMO-BAP-REC-02");
const approvedSource = recommendationMap.get("DEMO-BAP-REC-03");
if (!revisionSource || !approvedSource) throw new Error("Seed demo Bapperida harus dijalankan sebelum seed Wali Kota.");
const revision = await checked(await db.from("walikota_decisions").insert({ recommendation_id: revisionSource.id, recommendation_version: Math.max(1, revisionSource.version - 1), action: "REQUEST_REVISION", priority_level: "TINGGI", leader_note: "Lengkapi perbandingan capaian kuartal sebelumnya dan dampak fiskal sebelum realokasi diputuskan.", resulting_status: "PERLU_REVISI", is_fixture: false, decided_by: actor.id, decided_at: "2026-09-11T09:00:00+07:00" }).select("id").single());
await checked(await db.from("walikota_decision_events").insert({ decision_id: revision.id, recommendation_id: revisionSource.id, event_type: "REVISION_REQUESTED", from_status: "MENUNGGU_PERSETUJUAN", to_status: "PERLU_REVISI", note: "Lengkapi perbandingan capaian kuartal sebelumnya dan dampak fiskal sebelum realokasi diputuskan.", recommendation_version: revisionSource.version, actor_user_id: actor.id, event_at: "2026-09-11T09:00:00+07:00" }));
const approved = await checked(await db.from("walikota_decisions").insert({ recommendation_id: approvedSource.id, recommendation_version: Math.max(1, approvedSource.version - 1), action: "APPROVE", priority_level: "MENDESAK", leader_note: "Setujui evaluasi kriteria kelulusan dan minta Dinsos memimpin tindak lanjut lintas jalur.", resulting_status: "DITINDAKLANJUTI", is_fixture: false, decided_by: actor.id, decided_at: "2026-09-12T10:00:00+07:00" }).select("id").single());
await checked(await db.from("walikota_dispositions").insert({ decision_id: approved.id, target_opd_id: opdMap.get("DINSOS"), instruction: "Pimpin evaluasi kriteria kelulusan dan laporkan hasil koordinasi lintas jalur kepada Wali Kota.", due_date: demoDueDate, status: "DITERBITKAN" }));
await checked(await db.from("walikota_decision_events").insert([{ decision_id: approved.id, recommendation_id: approvedSource.id, event_type: "APPROVED", from_status: "MENUNGGU_PERSETUJUAN", to_status: "DITINDAKLANJUTI", note: "Setujui evaluasi kriteria kelulusan dan minta Dinsos memimpin tindak lanjut lintas jalur.", recommendation_version: approvedSource.version, actor_user_id: actor.id, event_at: "2026-09-12T10:00:00+07:00" }, { decision_id: approved.id, recommendation_id: approvedSource.id, event_type: "DISPOSITION_ISSUED", from_status: "DITINDAKLANJUTI", to_status: "DITINDAKLANJUTI", note: "Setujui evaluasi kriteria kelulusan dan minta Dinsos memimpin tindak lanjut lintas jalur.", recommendation_version: approvedSource.version, actor_user_id: actor.id, event_at: "2026-09-12T10:00:01+07:00" }]));
console.log("Demo persisten WALIKOTA: 2 keputusan dan 1 disposisi strategis PASS");
