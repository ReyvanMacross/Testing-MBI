import "server-only";

import type { KecamatanActor } from "@/lib/auth/require-kecamatan-actor";
import { maskNik } from "@/lib/privacy/mask-nik";
import { createAdminClient } from "@/lib/supabase/admin";

export type KecamatanProgram = { id: string; code: string; name: string; opdId: string; opdCode: string; opdName: string; path: string; category: string };
export type KecamatanDocument = { id: string; type: string; label: string; status: string };
export type KecamatanEvent = { id: string; title: string; note: string; date: string; type: string };
export type KecamatanSurvey = { id: string; status: string; surveyor: string; dueDate: string; score: number | null; factualDesil: number | null; notes: string; reviewNote: string; surveyedAt: string | null };
export type KecamatanReferral = { id: string; code: string; status: string; sentAt: string; category: string; slaHours: number; programName: string; opdName: string; opdCode: string; instruction: string; events: KecamatanEvent[] };
export type KecamatanCitizen = {
  id: string; name: string; maskedNik: string; maskedKk: string; kelurahanId: string; kelurahan: string;
  kecamatan: string; rt: string; rw: string; desil: number | null; pekerjaan: string; tanggungan: number;
  registeredAt: string; proposalId: string | null; proposalStatus: string; reason: string;
  targetProgramId: string | null; survey: KecamatanSurvey | null; referral: KecamatanReferral | null;
  documents: KecamatanDocument[]; events: KecamatanEvent[]; isFixture: boolean;
};
export type KecamatanData = {
  actor: { name: string; district: string; districtId: string };
  citizens: KecamatanCitizen[]; programs: KecamatanProgram[];
  kelurahan: Array<{ id: string; name: string }>;
  queueSummary: { waitingSurvey: number; assignedSurvey: number; waitingApproval: number; readyReferral: number; sentThisMonth: number };
  surveySummary: { total: number; approved: number; waiting: number };
  referralSummary: { total: number; waiting: number; processing: number; completed: number };
};

function fail(error: { message?: string } | null, message: string) { if (error) throw new Error(`${message}: ${error.message ?? "unknown"}`); }
function date(value: string | null | undefined) { if (!value) return "—"; return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(value)); }
function masked(value: string | null | undefined) { return maskNik(value); }

export async function getKecamatanData(actor: KecamatanActor): Promise<KecamatanData> {
  const admin = createAdminClient();
  const [citizenResult, kelurahanResult, programResult, proposalResult, detailResult] = await Promise.all([
    admin.from("warga").select("id,nik,nomor_kk,nama_lengkap,kelurahan_id,kecamatan_id,kelurahan,kecamatan,pekerjaan,jumlah_anggota_kk,created_at").eq("kecamatan_id", actor.kecamatanId).order("nama_lengkap").limit(500),
    admin.from("master_wilayah").select("id,nama").eq("parent_id", actor.kecamatanId).eq("jenis", "KELURAHAN").eq("is_active", true).order("nama"),
    admin.from("master_program_layanan").select("id,kode_program,nama_program,opd_id,jalur,jenis_intervensi,master_opd(kode_opd,nama_opd)").eq("is_active", true).not("jalur", "is", null).order("nama_program").limit(200),
    admin.from("kecamatan_warga_usulan").select("id,warga_id,kelurahan_id,rt,rw,desil_awal,target_program_id,alasan,status,is_fixture,created_at").eq("kecamatan_id", actor.kecamatanId).order("created_at", { ascending: false }).limit(500),
    admin.from("kecamatan_referral_details").select("referral_id,usulan_id,kategori_layanan,sla_hours").eq("kecamatan_id", actor.kecamatanId).order("created_at", { ascending: false }).limit(500),
  ]);
  for (const [result, label] of [[citizenResult, "Data warga"], [kelurahanResult, "Master kelurahan"], [programResult, "Program OPD"], [proposalResult, "Usulan Kecamatan"], [detailResult, "Rujukan Kecamatan"]] as const) fail(result.error, `${label} tidak dapat dibaca`);

  const citizens = citizenResult.data ?? [];
  const citizenIds = citizens.map((row) => row.id);
  const proposals = proposalResult.data ?? [];
  const proposalIds = proposals.map((row) => row.id);
  const referralDetails = detailResult.data ?? [];
  const referralIds = referralDetails.map((row) => row.referral_id);
  const [desilResult, surveyResult, documentResult, eventResult, referralResult, referralEventResult] = await Promise.all([
    citizenIds.length ? admin.from("penetapan_desil").select("warga_id,desil_dtsen,created_at").in("warga_id", citizenIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    proposalIds.length ? admin.from("kecamatan_survei").select("id,usulan_id,petugas_nama,due_date,status,skor,desil_faktual,catatan_faktual,review_note,surveyed_at").in("usulan_id", proposalIds) : Promise.resolve({ data: [], error: null }),
    proposalIds.length ? admin.from("kecamatan_documents").select("id,usulan_id,document_type,label,verification_status").in("usulan_id", proposalIds).order("created_at") : Promise.resolve({ data: [], error: null }),
    proposalIds.length ? admin.from("kecamatan_events").select("id,usulan_id,event_type,title,note,event_at").in("usulan_id", proposalIds).order("event_at") : Promise.resolve({ data: [], error: null }),
    referralIds.length ? admin.from("referral_mbi").select("id,referral_code,status,sent_at,target_program,instruction,target_opd_id,master_opd!referral_mbi_target_opd_id_fkey(kode_opd,nama_opd)").in("id", referralIds) : Promise.resolve({ data: [], error: null }),
    referralIds.length ? admin.from("referral_mbi_events").select("id,referral_id,event_type,title,note,event_at").in("referral_id", referralIds).order("event_at") : Promise.resolve({ data: [], error: null }),
  ]);
  for (const [result, label] of [[desilResult, "Desil warga"], [surveyResult, "Survei Kecamatan"], [documentResult, "Dokumen Kecamatan"], [eventResult, "Riwayat Kecamatan"], [referralResult, "Referral MBI"], [referralEventResult, "Riwayat referral"]] as const) fail(result.error, `${label} tidak dapat dibaca`);

  const programs: KecamatanProgram[] = (programResult.data ?? []).map((row) => {
    const opd = Array.isArray(row.master_opd) ? row.master_opd[0] : row.master_opd;
    return { id: row.id, code: row.kode_program, name: row.nama_program, opdId: row.opd_id, opdCode: opd?.kode_opd ?? "OPD", opdName: opd?.nama_opd ?? "OPD Teknis", path: row.jalur ?? "PENGUATAN_DASAR", category: row.jenis_intervensi ?? row.nama_program };
  });
  const programMap = new Map(programs.map((item) => [item.id, item]));
  const proposalMap = new Map<string, (typeof proposals)[number]>();
  for (const row of proposals) if (!proposalMap.has(row.warga_id)) proposalMap.set(row.warga_id, row);
  const surveyMap = new Map((surveyResult.data ?? []).map((row) => [row.usulan_id, row]));
  const docsMap = new Map<string, KecamatanDocument[]>();
  for (const row of documentResult.data ?? []) { const list = docsMap.get(row.usulan_id) ?? []; list.push({ id: row.id, type: row.document_type, label: row.label, status: row.verification_status }); docsMap.set(row.usulan_id, list); }
  const eventsMap = new Map<string, KecamatanEvent[]>();
  for (const row of eventResult.data ?? []) { const list = eventsMap.get(row.usulan_id) ?? []; list.push({ id: row.id, title: row.title, note: row.note ?? "", date: date(row.event_at), type: row.event_type }); eventsMap.set(row.usulan_id, list); }
  const referralEventMap = new Map<string, KecamatanEvent[]>();
  for (const row of referralEventResult.data ?? []) { const list = referralEventMap.get(row.referral_id) ?? []; list.push({ id: row.id, title: row.title, note: row.note ?? "", date: date(row.event_at), type: row.event_type }); referralEventMap.set(row.referral_id, list); }
  const referralMap = new Map((referralResult.data ?? []).map((row) => [row.id, row]));
  const detailMap = new Map(referralDetails.map((row) => [row.usulan_id, row]));
  const desilMap = new Map<string, number>();
  for (const row of desilResult.data ?? []) if (!desilMap.has(row.warga_id) && row.desil_dtsen) desilMap.set(row.warga_id, row.desil_dtsen);
  const kelurahanMap = new Map((kelurahanResult.data ?? []).map((row) => [row.id, row.nama]));

  const mappedCitizens: KecamatanCitizen[] = citizens.map((citizen) => {
    const proposal = proposalMap.get(citizen.id);
    const surveyRow = proposal ? surveyMap.get(proposal.id) : null;
    const detail = proposal ? detailMap.get(proposal.id) : null;
    const referralRow = detail ? referralMap.get(detail.referral_id) : null;
    const target = proposal?.target_program_id ? programMap.get(proposal.target_program_id) : null;
    const referralOpd = referralRow ? (Array.isArray(referralRow.master_opd) ? referralRow.master_opd[0] : referralRow.master_opd) : null;
    const survey: KecamatanSurvey | null = surveyRow ? { id: surveyRow.id, status: surveyRow.status, surveyor: surveyRow.petugas_nama, dueDate: date(surveyRow.due_date), score: surveyRow.skor, factualDesil: surveyRow.desil_faktual, notes: surveyRow.catatan_faktual ?? "", reviewNote: surveyRow.review_note ?? "", surveyedAt: surveyRow.surveyed_at } : null;
    const referral: KecamatanReferral | null = detail && referralRow ? { id: referralRow.id, code: referralRow.referral_code, status: referralRow.status, sentAt: date(referralRow.sent_at), category: detail.kategori_layanan, slaHours: detail.sla_hours, programName: referralRow.target_program ?? target?.name ?? "Program OPD", opdName: referralOpd?.nama_opd ?? target?.opdName ?? "OPD Teknis", opdCode: referralOpd?.kode_opd ?? target?.opdCode ?? "OPD", instruction: referralRow.instruction ?? "", events: referralEventMap.get(referralRow.id) ?? [] } : null;
    return {
      id: citizen.id, name: citizen.nama_lengkap, maskedNik: masked(citizen.nik), maskedKk: masked(citizen.nomor_kk),
      kelurahanId: citizen.kelurahan_id ?? "", kelurahan: citizen.kelurahan_id ? kelurahanMap.get(citizen.kelurahan_id) ?? citizen.kelurahan ?? "—" : citizen.kelurahan ?? "—",
      kecamatan: citizen.kecamatan ?? actor.kecamatanNama, rt: proposal?.rt ?? "—", rw: proposal?.rw ?? "—",
      desil: desilMap.get(citizen.id) ?? proposal?.desil_awal ?? null, pekerjaan: citizen.pekerjaan ?? "Belum tercatat",
      tanggungan: Math.max(0, Number(citizen.jumlah_anggota_kk ?? 1) - 1), registeredAt: date(citizen.created_at),
      proposalId: proposal?.id ?? null, proposalStatus: proposal?.status ?? "TERDATA", reason: proposal?.alasan ?? "",
      targetProgramId: proposal?.target_program_id ?? null, survey, referral,
      documents: proposal ? docsMap.get(proposal.id) ?? [] : [], events: proposal ? eventsMap.get(proposal.id) ?? [] : [],
      isFixture: proposal?.is_fixture ?? false,
    };
  });
  const referrals = mappedCitizens.flatMap((item) => item.referral ? [item.referral] : []);
  const surveys = mappedCitizens.flatMap((item) => item.survey ? [item.survey] : []);
  const monthParts = new Intl.DateTimeFormat("en", { year: "numeric", month: "2-digit", timeZone: "Asia/Jakarta" }).formatToParts(new Date());
  const monthKey = `${monthParts.find((part) => part.type === "year")?.value}-${monthParts.find((part) => part.type === "month")?.value}`;
  return {
    actor: { name: actor.namaLengkap, district: actor.kecamatanNama, districtId: actor.kecamatanId },
    citizens: mappedCitizens, programs, kelurahan: (kelurahanResult.data ?? []).map((row) => ({ id: row.id, name: row.nama })),
    queueSummary: {
      waitingSurvey: proposals.filter((item) => item.status === "MENUNGGU_SURVEI").length,
      assignedSurvey: proposals.filter((item) => item.status === "SURVEI_DITUGASKAN").length,
      waitingApproval: proposals.filter((item) => item.status === "MENUNGGU_PERSETUJUAN").length,
      readyReferral: proposals.filter((item) => item.status === "DISETUJUI").length,
      sentThisMonth: (referralResult.data ?? []).filter((item) => item.sent_at?.startsWith(monthKey)).length,
    },
    surveySummary: { total: surveys.length, approved: surveys.filter((item) => item.status === "DISETUJUI").length, waiting: surveys.filter((item) => item.status === "MENUNGGU_PERSETUJUAN").length },
    referralSummary: { total: referrals.length, waiting: referrals.filter((item) => item.status === "TERKIRIM").length, processing: referrals.filter((item) => item.status === "DITERIMA" || item.status === "DIPROSES").length, completed: referrals.filter((item) => item.status === "SELESAI").length },
  };
}
