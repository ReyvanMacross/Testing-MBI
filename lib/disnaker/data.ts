import "server-only";

import { maskNik } from "@/lib/privacy/mask-nik";
import { createAdminClient } from "@/lib/supabase/admin";

export type DisnakerReferralStatus = "PERLU_DIPROSES" | "SEDANG_PELATIHAN" | "BEKERJA_SELESAI";
export type DisnakerParticipantStatus = "AKTIF_PELATIHAN" | "LULUS_MAGANG" | "BEKERJA_SELESAI" | "TIDAK_AKTIF";

export type DisnakerTimelineEvent = {
  id: string;
  type: "STARTED" | "PROGRESS_UPDATED" | "COMPLETED" | "CANCELLED";
  date: string;
  note: string;
  attendance: number | null;
};

export type DisnakerReferral = {
  id: string;
  interventionId: string | null;
  code: string;
  name: string;
  maskedNik: string;
  date: string;
  programId: string | null;
  program: string;
  lembagaId: string | null;
  institution: string;
  desil: number;
  kelurahan: string;
  status: DisnakerReferralStatus;
  participantStatus: DisnakerParticipantStatus | null;
  instruction: string;
  attendance: number | null;
  mitraIndustriId: string | null;
  placementPartner: string | null;
  placementDate: string | null;
  evaluation: string | null;
  timeline: DisnakerTimelineEvent[];
  isPreview: boolean;
};

export type DisnakerProgram = {
  id: string;
  code: string;
  name: string;
  category: string;
  lembagaId: string;
  institution: string;
  duration: string;
  filled: number;
  capacity: number;
  status: "AKTIF" | "PENUH" | "NONAKTIF";
  location: string;
  qualification: string;
  isPreview: boolean;
};

export type DisnakerProvider = {
  id: string;
  code: string;
  name: string;
  type: "BLK" | "LPK" | "LAINNYA";
  address: string;
};

export type DisnakerIndustryPartner = {
  id: string;
  code: string;
  name: string;
  sector: string;
  status: "AKTIF" | "NONAKTIF";
};

export type PlacementWorker = {
  id: string;
  referralCode: string;
  name: string;
  maskedNik: string;
  program: string;
  placementDate: string;
  workerStatus: "AKTIF_BEKERJA" | "BERHENTI";
};

export type PlacementPartner = {
  id: string;
  name: string;
  sector: string;
  absorbed: number;
  program: string;
  status: "AKTIF" | "NONAKTIF";
  workers: PlacementWorker[];
};

export const previewEnabled =
  process.env.NODE_ENV !== "production" &&
  process.env.DISNAKER_PREVIEW_MODE === "true";

const PREVIEW_PROVIDER: DisnakerProvider = {
  id: "preview-provider",
  code: "PREVIEW-BLK",
  name: "BLK Kota Bandung (Pratinjau)",
  type: "BLK",
  address: "Kota Bandung",
};

const PREVIEW_PARTNER: DisnakerIndustryPartner = {
  id: "preview-partner",
  code: "PREVIEW-MITRA",
  name: "Mitra Industri Pratinjau",
  sector: "Pratinjau",
  status: "AKTIF",
};

const PREVIEW_PROGRAM: DisnakerProgram = {
  id: "preview-program",
  code: "PRG-VOK-01",
  name: "Pelatihan Vokasi & Magang Kerja",
  category: "Teknik & Manufaktur",
  lembagaId: PREVIEW_PROVIDER.id,
  institution: PREVIEW_PROVIDER.name,
  duration: "3 Bulan",
  filled: 1,
  capacity: 20,
  status: "AKTIF",
  location: "Kota Bandung",
  qualification: "Sertifikat kompetensi dan kesiapan kerja",
  isPreview: true,
};

const PREVIEW_REFERRAL: DisnakerReferral = {
  id: "preview-referral",
  interventionId: null,
  code: "REF-2026-003",
  name: "Warga Pratinjau",
  maskedNik: "3273xxxxxxxx1234",
  date: "18 Feb 2026",
  programId: PREVIEW_PROGRAM.id,
  program: PREVIEW_PROGRAM.name,
  lembagaId: PREVIEW_PROVIDER.id,
  institution: PREVIEW_PROVIDER.name,
  desil: 2,
  kelurahan: "Sekeloa",
  status: "PERLU_DIPROSES",
  participantStatus: null,
  instruction: "Peserta membawa kelengkapan administrasi pada orientasi pembekalan.",
  attendance: null,
  mitraIndustriId: null,
  placementPartner: null,
  placementDate: null,
  evaluation: null,
  timeline: [],
  isPreview: true,
};

function fail(error: { message?: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message ?? "database error"}`);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function mapStatus(status: string): DisnakerReferralStatus {
  if (status === "SELESAI") return "BEKERJA_SELESAI";
  if (status === "DITERIMA" || status === "DIPROSES") return "SEDANG_PELATIHAN";
  return "PERLU_DIPROSES";
}

export async function getDisnakerProviders(): Promise<DisnakerProvider[]> {
  if (previewEnabled) return [PREVIEW_PROVIDER];
  const admin = createAdminClient();
  const result = await admin.from("disnaker_lembaga_pelaksana")
    .select("id,kode,nama,jenis,alamat").eq("is_active", true).order("nama");
  fail(result.error, "Master lembaga Disnaker tidak tersedia");
  return (result.data ?? []).map((row) => ({
    id: row.id, code: row.kode, name: row.nama, type: row.jenis,
    address: row.alamat ?? "—",
  }));
}

export async function getDisnakerIndustryPartners(): Promise<DisnakerIndustryPartner[]> {
  if (previewEnabled) return [PREVIEW_PARTNER];
  const admin = createAdminClient();
  const result = await admin.from("disnaker_mitra_industri")
    .select("id,kode_mitra,nama_perusahaan,sektor_industri,status_kemitraan")
    .eq("status_kemitraan", "AKTIF").order("nama_perusahaan");
  fail(result.error, "Master mitra industri Disnaker tidak tersedia");
  return (result.data ?? []).map((row) => ({
    id: row.id, code: row.kode_mitra, name: row.nama_perusahaan,
    sector: row.sektor_industri ?? "Belum ditentukan", status: row.status_kemitraan,
  }));
}

export async function getDisnakerPrograms(): Promise<DisnakerProgram[]> {
  if (previewEnabled) return [PREVIEW_PROGRAM];
  const admin = createAdminClient();
  const opd = await admin.from("master_opd").select("id").eq("kode_opd", "DISNAKER").single();
  fail(opd.error, "Master OPD DISNAKER tidak tersedia");
  if (!opd.data) throw new Error("Master OPD DISNAKER tidak tersedia.");
  const programResult = await admin.from("master_program_layanan")
    .select("id,kode_program,nama_program,is_active")
    .eq("opd_id", opd.data.id).eq("jalur", "PEKERJA").order("nama_program");
  fail(programResult.error, "Program Disnaker tidak dapat dibaca");
  if (!programResult.data?.length) return [];

  const ids = programResult.data.map((row) => row.id);
  const [detailsResult, interventionsResult] = await Promise.all([
    admin.from("disnaker_program_details")
      .select("program_id,category,lembaga_id,institution,location,duration_value,duration_unit,capacity,qualification")
      .in("program_id", ids),
    admin.from("disnaker_interventions").select("program_id,participant_status")
      .in("program_id", ids).neq("participant_status", "TIDAK_AKTIF"),
  ]);
  fail(detailsResult.error, "Detail program Disnaker tidak dapat dibaca");
  fail(interventionsResult.error, "Kapasitas program Disnaker tidak dapat dihitung");
  const details = new Map((detailsResult.data ?? []).map((row) => [row.program_id, row]));
  const providerIds = [...new Set((detailsResult.data ?? []).map((row) => row.lembaga_id).filter(Boolean))];
  const providerResult = providerIds.length
    ? await admin.from("disnaker_lembaga_pelaksana").select("id,nama,alamat").in("id", providerIds)
    : { data: [], error: null };
  fail(providerResult.error, "Lembaga program Disnaker tidak dapat dibaca");
  const providers = new Map((providerResult.data ?? []).map((row) => [row.id, row]));
  const filled = new Map<string, number>();
  for (const row of interventionsResult.data ?? []) filled.set(row.program_id, (filled.get(row.program_id) ?? 0) + 1);

  return programResult.data.map((program) => {
    const detail = details.get(program.id);
    if (!detail?.lembaga_id) throw new Error(`Program ${program.kode_program} belum memiliki detail/lembaga canonical.`);
    const provider = providers.get(detail.lembaga_id);
    if (!provider) throw new Error(`Lembaga untuk program ${program.kode_program} tidak ditemukan.`);
    const occupied = filled.get(program.id) ?? 0;
    return {
      id: program.id, code: program.kode_program, name: program.nama_program,
      category: detail.category, lembagaId: detail.lembaga_id, institution: provider.nama,
      duration: `${detail.duration_value} ${detail.duration_unit.charAt(0)}${detail.duration_unit.slice(1).toLowerCase()}`,
      filled: occupied, capacity: detail.capacity,
      status: !program.is_active ? "NONAKTIF" : occupied >= detail.capacity ? "PENUH" : "AKTIF",
      location: detail.location ?? provider.alamat ?? provider.nama,
      qualification: detail.qualification ?? "Belum ditentukan", isPreview: false,
    };
  });
}

export async function getDisnakerReferrals(): Promise<DisnakerReferral[]> {
  if (previewEnabled) return [PREVIEW_REFERRAL];
  const admin = createAdminClient();
  const opd = await admin.from("master_opd").select("id").eq("kode_opd", "DISNAKER").single();
  fail(opd.error, "Master OPD DISNAKER tidak tersedia");
  if (!opd.data) throw new Error("Master OPD DISNAKER tidak tersedia.");
  const referralResult = await admin.from("referral_mbi")
    .select("id,referral_code,warga_id,program_id,status,referral_date,sent_at,target_program,instruction")
    .eq("target_opd_id", opd.data.id).eq("referral_type", "JALUR_MBI")
    .eq("jalur", "PEKERJA").neq("status", "DIBATALKAN")
    .order("created_at", { ascending: false }).limit(100);
  fail(referralResult.error, "Referral Disnaker tidak dapat dibaca");
  const referrals = referralResult.data ?? [];
  if (!referrals.length) return [];

  const referralIds = referrals.map((row) => row.id);
  const wargaIds = [...new Set(referrals.map((row) => row.warga_id))];
  const interventionResult = await admin.from("disnaker_interventions")
    .select("id,referral_id,program_id,lembaga_id,institution,start_date,participant_instruction,participant_status,attendance_percent,placement_partner,placement_date,evaluation_note")
    .in("referral_id", referralIds);
  fail(interventionResult.error, "Intervensi Disnaker tidak dapat dibaca");
  const interventions = interventionResult.data ?? [];
  const interventionIds = interventions.map((row) => row.id);
  const programIds = [...new Set([...referrals.map((row) => row.program_id), ...interventions.map((row) => row.program_id)].filter(Boolean))];

  const [wargaResult, desilResult, programsResult, detailsResult, eventsResult, placementsResult] = await Promise.all([
    admin.from("warga").select("id,nik,nama_lengkap,kelurahan").in("id", wargaIds),
    admin.from("penetapan_desil").select("warga_id,desil_dtsen,created_at").in("warga_id", wargaIds).order("created_at", { ascending: false }),
    programIds.length ? admin.from("master_program_layanan").select("id,nama_program").in("id", programIds) : Promise.resolve({ data: [], error: null }),
    programIds.length ? admin.from("disnaker_program_details").select("program_id,lembaga_id,institution").in("program_id", programIds) : Promise.resolve({ data: [], error: null }),
    interventionIds.length ? admin.from("disnaker_intervention_events").select("id,intervention_id,event_type,event_at,note,attendance_percent").in("intervention_id", interventionIds).order("event_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
    interventionIds.length ? admin.from("disnaker_penempatan_kerja").select("intervention_id,mitra_industri_id,tanggal_penempatan,evaluasi_akhir").in("intervention_id", interventionIds) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const [result, context] of [
    [wargaResult, "Warga referral Disnaker tidak dapat dibaca"],
    [desilResult, "Desil referral Disnaker tidak dapat dibaca"],
    [programsResult, "Program referral Disnaker tidak dapat dibaca"],
    [detailsResult, "Detail program referral Disnaker tidak dapat dibaca"],
    [eventsResult, "Timeline intervensi Disnaker tidak dapat dibaca"],
    [placementsResult, "Penempatan kerja Disnaker tidak dapat dibaca"],
  ] as const) fail(result.error, context);

  const placementRows = placementsResult.data ?? [];
  const partnerIds = [...new Set(placementRows.map((row) => row.mitra_industri_id))];
  const partnersResult = partnerIds.length
    ? await admin.from("disnaker_mitra_industri").select("id,nama_perusahaan").in("id", partnerIds)
    : { data: [], error: null };
  fail(partnersResult.error, "Mitra penempatan Disnaker tidak dapat dibaca");

  const wargaMap = new Map((wargaResult.data ?? []).map((row) => [row.id, row]));
  const desilMap = new Map<string, number>();
  for (const row of desilResult.data ?? []) if (!desilMap.has(row.warga_id)) desilMap.set(row.warga_id, row.desil_dtsen ?? 0);
  const programMap = new Map((programsResult.data ?? []).map((row) => [row.id, row.nama_program]));
  const detailMap = new Map((detailsResult.data ?? []).map((row) => [row.program_id, row]));
  const interventionMap = new Map(interventions.map((row) => [row.referral_id, row]));
  const placementMap = new Map(placementRows.map((row) => [row.intervention_id, row]));
  const partnerMap = new Map((partnersResult.data ?? []).map((row) => [row.id, row.nama_perusahaan]));
  const eventMap = new Map<string, DisnakerTimelineEvent[]>();
  for (const row of eventsResult.data ?? []) {
    const list = eventMap.get(row.intervention_id) ?? [];
    list.push({ id: row.id, type: row.event_type, date: formatDate(row.event_at), note: row.note ?? "—", attendance: row.attendance_percent });
    eventMap.set(row.intervention_id, list);
  }

  return referrals.flatMap((referral): DisnakerReferral[] => {
    const warga = wargaMap.get(referral.warga_id);
    if (!warga) return [];
    const intervention = interventionMap.get(referral.id) ?? null;
    const effectiveProgramId = intervention?.program_id ?? referral.program_id;
    const detail = effectiveProgramId ? detailMap.get(effectiveProgramId) : null;
    const placement = intervention ? placementMap.get(intervention.id) : null;
    return [{
      id: referral.id, interventionId: intervention?.id ?? null, code: referral.referral_code,
      name: warga.nama_lengkap, maskedNik: maskNik(warga.nik),
      date: formatDate(referral.referral_date ?? referral.sent_at), programId: effectiveProgramId ?? null,
      program: (effectiveProgramId ? programMap.get(effectiveProgramId) : null) ?? referral.target_program ?? "Belum dipilih",
      lembagaId: intervention?.lembaga_id ?? detail?.lembaga_id ?? null,
      institution: intervention?.institution ?? detail?.institution ?? "Belum dipilih",
      desil: desilMap.get(referral.warga_id) ?? 0, kelurahan: warga.kelurahan ?? "—",
      status: mapStatus(referral.status), participantStatus: intervention?.participant_status ?? null,
      instruction: referral.instruction ?? intervention?.participant_instruction ?? "",
      attendance: intervention?.attendance_percent ?? null,
      mitraIndustriId: placement?.mitra_industri_id ?? null,
      placementPartner: placement ? partnerMap.get(placement.mitra_industri_id) ?? intervention?.placement_partner ?? null : intervention?.placement_partner ?? null,
      placementDate: formatDate(placement?.tanggal_penempatan ?? intervention?.placement_date ?? null),
      evaluation: placement?.evaluasi_akhir ?? intervention?.evaluation_note ?? null,
      timeline: intervention ? eventMap.get(intervention.id) ?? [] : [], isPreview: false,
    }];
  });
}

export async function getDisnakerDashboardData() {
  const referrals = await getDisnakerReferrals();
  return {
    referrals,
    summary: {
      newReferrals: referrals.filter((item) => item.status === "PERLU_DIPROSES").length,
      inTraining: referrals.filter((item) => item.status === "SEDANG_PELATIHAN").length,
      placed: referrals.filter((item) => item.status === "BEKERJA_SELESAI").length,
    },
    preview: previewEnabled,
  };
}

export async function getDisnakerPlacementReport() {
  if (previewEnabled) return { partners: [] as PlacementPartner[], summary: { placed: 0, partnerCount: 0, placementRate: null } };
  const admin = createAdminClient();
  const aggregate = await admin.rpc("list_disnaker_placement_partners", {
    p_search: null, p_sector: null, p_status: null, p_limit: 100, p_offset: 0,
  });
  fail(aggregate.error, "Laporan penempatan Disnaker tidak dapat dibaca");
  const aggregateRows = aggregate.data ?? [];
  if (!aggregateRows.length) return { partners: [] as PlacementPartner[], summary: { placed: 0, partnerCount: 0, placementRate: null } };

  const companyIds = aggregateRows.map((row: { company_id: string }) => row.company_id);
  const placementResult = await admin.from("disnaker_penempatan_kerja")
    .select("id,intervention_id,mitra_industri_id,tanggal_penempatan,status_pekerja")
    .in("mitra_industri_id", companyIds);
  fail(placementResult.error, "Detail penempatan Disnaker tidak dapat dibaca");
  const placements = placementResult.data ?? [];
  const interventionIds = placements.map((row) => row.intervention_id);
  const interventionResult = interventionIds.length
    ? await admin.from("disnaker_interventions").select("id,referral_id,program_id").in("id", interventionIds)
    : { data: [], error: null };
  fail(interventionResult.error, "Intervensi laporan Disnaker tidak dapat dibaca");
  const interventions = interventionResult.data ?? [];
  const referralIds = interventions.map((row) => row.referral_id);
  const programIds = [...new Set(interventions.map((row) => row.program_id))];
  const [referralResult, programResult] = await Promise.all([
    referralIds.length ? admin.from("referral_mbi").select("id,referral_code,warga_id").in("id", referralIds) : Promise.resolve({ data: [], error: null }),
    programIds.length ? admin.from("master_program_layanan").select("id,nama_program").in("id", programIds) : Promise.resolve({ data: [], error: null }),
  ]);
  fail(referralResult.error, "Referral laporan Disnaker tidak dapat dibaca");
  fail(programResult.error, "Program laporan Disnaker tidak dapat dibaca");
  const wargaIds = [...new Set((referralResult.data ?? []).map((row) => row.warga_id))];
  const wargaResult = wargaIds.length
    ? await admin.from("warga").select("id,nik,nama_lengkap").in("id", wargaIds)
    : { data: [], error: null };
  fail(wargaResult.error, "Warga laporan Disnaker tidak dapat dibaca");

  const interventionMap = new Map(interventions.map((row) => [row.id, row]));
  const referralMap = new Map((referralResult.data ?? []).map((row) => [row.id, row]));
  const programMap = new Map((programResult.data ?? []).map((row) => [row.id, row.nama_program]));
  const wargaMap = new Map((wargaResult.data ?? []).map((row) => [row.id, row]));
  const workersByCompany = new Map<string, PlacementWorker[]>();
  for (const placement of placements) {
    const intervention = interventionMap.get(placement.intervention_id);
    const referral = intervention ? referralMap.get(intervention.referral_id) : null;
    const warga = referral ? wargaMap.get(referral.warga_id) : null;
    if (!intervention || !referral || !warga) continue;
    const workers = workersByCompany.get(placement.mitra_industri_id) ?? [];
    workers.push({
      id: placement.id, referralCode: referral.referral_code, name: warga.nama_lengkap,
      maskedNik: maskNik(warga.nik), program: programMap.get(intervention.program_id) ?? "—",
      placementDate: formatDate(placement.tanggal_penempatan), workerStatus: placement.status_pekerja,
    });
    workersByCompany.set(placement.mitra_industri_id, workers);
  }

  const partners: PlacementPartner[] = aggregateRows.map((row: {
    company_id: string; company_name: string; sector: string | null;
    workers_absorbed: number; related_program: string | null; partnership_status: "AKTIF" | "NONAKTIF";
  }) => ({
    id: row.company_id, name: row.company_name, sector: row.sector ?? "Belum ditentukan",
    absorbed: Number(row.workers_absorbed), program: row.related_program ?? "—",
    status: row.partnership_status, workers: workersByCompany.get(row.company_id) ?? [],
  }));
  return { partners, summary: { placed: placements.length, partnerCount: partners.length, placementRate: null } };
}
