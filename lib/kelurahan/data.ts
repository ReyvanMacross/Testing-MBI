import "server-only";

import type { KelurahanActor } from "@/lib/auth/require-kelurahan-actor";
import { maskNik } from "@/lib/privacy/mask-nik";
import { createAdminClient } from "@/lib/supabase/admin";

export type KelurahanProgram = { id: string; code: string; name: string; category: string; opdCode: string; opdName: string };
export type KelurahanDocument = { id: string; type: string; label: string; status: string };
export type KelurahanEvent = { id: string; title: string; note: string; date: string; timestamp: string; type: string };
export type KelurahanSurvey = { id: string; status: string; surveyor: string; surveyorProfileId: string | null; instruction: string; score: number | null; factualDesil: number | null; notes: string; surveyedAt: string | null };
export type KelurahanProposal = {
  id: string; citizenId: string; name: string; maskedNik: string; maskedKk: string;
  rt: string; rw: string; estimatedDesil: number; targetProgramId: string; targetProgram: string;
  targetOpd: string; targetOpdCode: string; category: string; reason: string; status: string;
  kecamatanStatus: string | null; version: number; createdAt: string; submittedAt: string | null;
  survey: KelurahanSurvey | null; documents: KelurahanDocument[]; events: KelurahanEvent[]; isFixture: boolean;
};
export type KelurahanData = {
  actor: { name: string; village: string; villageId: string; district: string; districtId: string };
  proposals: KelurahanProposal[]; programs: KelurahanProgram[];
  surveyors: Array<{ id: string; name: string }>;
  summary: { waitingRtRw: number; villageVerification: number; districtValidation: number; readyReferral: number; sentThisMonth: number };
};

function fail(error: { message?: string } | null, label: string) { if (error) throw new Error(`${label}: ${error.message ?? "unknown"}`); }
function humanizeCode(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}
function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

export async function getKelurahanData(actor: KelurahanActor): Promise<KelurahanData> {
  const admin = createAdminClient();
  const [proposalResult, programResult, surveyorResult] = await Promise.all([
    admin.from("kelurahan_usulan").select("id,warga_id,rt,rw,estimated_desil,target_program_id,reason,status,kecamatan_usulan_id,submitted_to_kecamatan_at,version,is_fixture,created_at").eq("kelurahan_id", actor.kelurahanId).order("created_at", { ascending: false }).limit(500),
    admin.from("master_program_layanan").select("id,kode_program,nama_program,jenis_intervensi,opd_id,master_opd(kode_opd,nama_opd)").eq("is_active", true).order("nama_program").limit(300),
    admin.from("user_profiles").select("id,nama_lengkap,role,status").eq("wilayah_id", actor.kelurahanId).eq("status", "AKTIF").in("role", ["Operator Kelurahan", "Operator Lapangan"]).order("nama_lengkap"),
  ]);
  fail(proposalResult.error, "Usulan Kelurahan tidak dapat dibaca");
  fail(programResult.error, "Program layanan tidak dapat dibaca");
  fail(surveyorResult.error, "Surveyor Kelurahan tidak dapat dibaca");
  const rawProposals = proposalResult.data ?? [];
  const proposalIds = rawProposals.map((row) => row.id);
  const citizenIds = [...new Set(rawProposals.map((row) => row.warga_id))];
  const kecamatanIds = rawProposals.flatMap((row) => row.kecamatan_usulan_id ? [row.kecamatan_usulan_id] : []);
  const [citizenResult, surveyResult, documentResult, eventResult, kecamatanResult, referralDetailResult] = await Promise.all([
    citizenIds.length ? admin.from("warga").select("id,nik,nomor_kk,nama_lengkap").in("id", citizenIds) : Promise.resolve({ data: [], error: null }),
    proposalIds.length ? admin.from("kelurahan_surveys").select("id,usulan_id,status,surveyor_profile_id,surveyor_name,instruction,score,factual_desil,factual_notes,surveyed_at").in("usulan_id", proposalIds) : Promise.resolve({ data: [], error: null }),
    proposalIds.length ? admin.from("kelurahan_documents").select("id,usulan_id,document_type,label,verification_status").in("usulan_id", proposalIds).order("created_at") : Promise.resolve({ data: [], error: null }),
    proposalIds.length ? admin.from("kelurahan_events").select("id,usulan_id,event_type,title,note,event_at").in("usulan_id", proposalIds).order("event_at") : Promise.resolve({ data: [], error: null }),
    kecamatanIds.length ? admin.from("kecamatan_warga_usulan").select("id,status").in("id", kecamatanIds) : Promise.resolve({ data: [], error: null }),
    kecamatanIds.length ? admin.from("kecamatan_referral_details").select("usulan_id,referral_id,referral_mbi!kecamatan_referral_details_referral_id_fkey(sent_at)").in("usulan_id", kecamatanIds) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const [result, label] of [[citizenResult,"Warga"],[surveyResult,"Survei"],[documentResult,"Dokumen"],[eventResult,"Riwayat"],[kecamatanResult,"Handoff Kecamatan"],[referralDetailResult,"Referral Kecamatan"]] as const) fail(result.error, `${label} Kelurahan tidak dapat dibaca`);

  const programs: KelurahanProgram[] = (programResult.data ?? []).map((row) => {
    const opd = Array.isArray(row.master_opd) ? row.master_opd[0] : row.master_opd;
    return { id: row.id, code: row.kode_program, name: row.nama_program, category: row.jenis_intervensi ? humanizeCode(row.jenis_intervensi) : row.nama_program, opdCode: opd?.kode_opd ?? "OPD", opdName: opd?.nama_opd ?? "OPD Teknis" };
  });
  const programMap = new Map(programs.map((row) => [row.id,row]));
  const citizenMap = new Map((citizenResult.data ?? []).map((row) => [row.id,row]));
  const surveyMap = new Map((surveyResult.data ?? []).map((row) => [row.usulan_id,row]));
  const kecamatanMap = new Map((kecamatanResult.data ?? []).map((row) => [row.id,row.status]));
  const docsMap = new Map<string,KelurahanDocument[]>();
  for (const row of documentResult.data ?? []) { const list=docsMap.get(row.usulan_id) ?? []; list.push({id:row.id,type:row.document_type,label:row.label,status:row.verification_status}); docsMap.set(row.usulan_id,list); }
  const eventsMap = new Map<string,KelurahanEvent[]>();
  for (const row of eventResult.data ?? []) { const list=eventsMap.get(row.usulan_id) ?? []; list.push({id:row.id,type:row.event_type,title:row.title,note:row.note ?? "",date:formatDate(row.event_at),timestamp:row.event_at}); eventsMap.set(row.usulan_id,list); }

  const proposals: KelurahanProposal[] = rawProposals.flatMap((row) => {
    const citizen=citizenMap.get(row.warga_id); if(!citizen) return [];
    const program=programMap.get(row.target_program_id);
    const survey=surveyMap.get(row.id);
    return [{
      id:row.id,citizenId:row.warga_id,name:citizen.nama_lengkap,maskedNik:maskNik(citizen.nik),maskedKk:maskNik(citizen.nomor_kk),
      rt:row.rt,rw:row.rw,estimatedDesil:row.estimated_desil,targetProgramId:row.target_program_id,
      targetProgram:program?.name ?? "Program OPD",targetOpd:program?.opdName ?? "OPD Teknis",targetOpdCode:program?.opdCode ?? "OPD",
      category:program?.category ?? "Layanan MBI",reason:row.reason,status:row.status,
      kecamatanStatus:row.kecamatan_usulan_id ? kecamatanMap.get(row.kecamatan_usulan_id) ?? null : null,
      version:row.version,createdAt:formatDate(row.created_at),submittedAt:row.submitted_to_kecamatan_at,
      survey:survey ? {id:survey.id,status:survey.status,surveyor:survey.surveyor_name,surveyorProfileId:survey.surveyor_profile_id,instruction:survey.instruction,score:survey.score,factualDesil:survey.factual_desil,notes:survey.factual_notes ?? "",surveyedAt:survey.surveyed_at} : null,
      documents:docsMap.get(row.id) ?? [],events:eventsMap.get(row.id) ?? [],isFixture:row.is_fixture,
    }];
  });
  const nowParts = new Intl.DateTimeFormat("en-CA", { year:"numeric",month:"2-digit",timeZone:"Asia/Jakarta" }).format(new Date());
  const sentThisMonth = (referralDetailResult.data ?? []).filter((row) => {
    const referral=Array.isArray(row.referral_mbi) ? row.referral_mbi[0] : row.referral_mbi;
    return referral?.sent_at?.startsWith(nowParts);
  }).length;
  return {
    actor:{name:actor.namaLengkap,village:actor.kelurahanNama,villageId:actor.kelurahanId,district:actor.kecamatanNama,districtId:actor.kecamatanId},
    proposals,programs,surveyors:(surveyorResult.data ?? []).map((row)=>({id:row.id,name:row.nama_lengkap})),
    summary:{
      waitingRtRw:proposals.filter((row)=>row.status==="MENUNGGU_VERIFIKASI_RT_RW").length,
      villageVerification:proposals.filter((row)=>row.status==="SURVEI_LAPANGAN").length,
      districtValidation:proposals.filter((row)=>row.kecamatanStatus==="MENUNGGU_PERSETUJUAN").length,
      readyReferral:proposals.filter((row)=>row.kecamatanStatus==="DISETUJUI").length,
      sentThisMonth,
    },
  };
}
