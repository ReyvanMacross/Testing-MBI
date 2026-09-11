import "server-only";

import { maskNik } from "@/lib/privacy/mask-nik";
import { createAdminClient } from "@/lib/supabase/admin";

export type CiptaBintarReferralStatus = "PERLU_DIPROSES" | "SEDANG_REHABILITASI" | "HUNIAN_LAYAK_SELESAI";
export type CiptaBintarParticipantStatus = "DALAM_PENGERJAAN" | "HUNIAN_LAYAK_SELESAI" | "TIDAK_AKTIF";
export type CiptaBintarFeasibilityStatus = "BELUM_DIVERIFIKASI" | "PROGRES_FISIK" | "LAYAK_HUNI_BERFUNGSI";

export type CiptaBintarTimelineEvent = {
  id: string;
  type: "STARTED" | "PROGRESS_UPDATED" | "COMPLETED" | "CANCELLED";
  date: string;
  note: string;
  progress: number | null;
};

export type CiptaBintarReferral = {
  id: string;
  interventionId: string | null;
  code: string;
  name: string;
  maskedNik: string;
  date: string;
  programId: string | null;
  program: string;
  petugasId: string | null;
  officerName: string;
  desil: number;
  kelurahan: string;
  status: CiptaBintarReferralStatus;
  participantStatus: CiptaBintarParticipantStatus | null;
  feasibilityStatus: CiptaBintarFeasibilityStatus | null;
  aidPackage: string;
  actionPlan: string;
  allocatedBudget: number | null;
  progress: number | null;
  objectLocation: string | null;
  realizationValue: number | null;
  objectAddress: string;
  infrastructureCategory: string;
  evaluation: string | null;
  timeline: CiptaBintarTimelineEvent[];
};

export type CiptaBintarProgram = {
  id: string;
  code: string;
  name: string;
  category: string;
  petugasId: string;
  officerName: string;
  serviceArea: string;
  duration: string;
  filled: number;
  capacity: number;
  status: "AKTIF" | "PENUH" | "NONAKTIF";
  location: string;
  facilitation: string;
  budgetPerUnit: number;
};

export type CiptaBintarOfficer = {
  id: string;
  code: string;
  name: string;
  serviceArea: string;
  location: string;
};

export type InfrastructureHistory = {
  id: string;
  period: string;
  amount: number;
  progress: number;
  status: "TERVERIFIKASI" | "MENUNGGU_VERIFIKASI";
};

export type InfrastructureReport = {
  id: string;
  referralCode: string;
  name: string;
  maskedNik: string;
  objectAddress: string;
  objectLocation: string;
  category: string;
  realizationValue: number;
  status: "LAYAK" | "DALAM_PENGERJAAN";
  desil: number;
  kelurahan: string;
  aidPackage: string;
  growthPercent: number;
  progressPercent: number;
  history: InfrastructureHistory[];
};

export const previewEnabled =
  process.env.NODE_ENV !== "production" &&
  process.env.CIPTA_BINTAR_PREVIEW_MODE === "true";

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

function formatPeriod(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatSchedule(startValue: string, duration: number, unit: string) {
  const start = new Date(`${startValue}T00:00:00Z`);
  const end = new Date(start);
  if (unit === "HARI") end.setUTCDate(end.getUTCDate() + duration);
  else if (unit === "MINGGU") end.setUTCDate(end.getUTCDate() + (duration * 7));
  else end.setUTCMonth(end.getUTCMonth() + duration);
  const compact = (value: Date) => new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  }).format(value);
  return `${compact(start)} - ${compact(end)}`;
}

function mapStatus(status: string): CiptaBintarReferralStatus {
  if (status === "SELESAI") return "HUNIAN_LAYAK_SELESAI";
  if (status === "DITERIMA" || status === "DIPROSES") return "SEDANG_REHABILITASI";
  return "PERLU_DIPROSES";
}

export async function getCiptaBintarOfficers(): Promise<CiptaBintarOfficer[]> {
  if (previewEnabled) return [];
  const admin = createAdminClient();
  const result = await admin
    .from("cipta_bintar_petugas")
    .select("id,kode,nama,wilayah_tugas,lokasi")
    .eq("is_active", true)
    .order("nama");
  fail(result.error, "Master petugas CIPTA_BINTAR tidak tersedia");
  return (result.data ?? []).map((row) => ({
    id: row.id,
    code: row.kode,
    name: row.nama,
    serviceArea: row.wilayah_tugas ?? "Infrastruktur dan permukiman",
    location: row.lokasi ?? "Kota Bandung",
  }));
}

export async function getCiptaBintarPrograms(): Promise<CiptaBintarProgram[]> {
  if (previewEnabled) return [];
  const admin = createAdminClient();
  const opd = await admin.from("master_opd").select("id").eq("kode_opd", "CIPTA_BINTAR").single();
  fail(opd.error, "Master OPD CIPTA_BINTAR tidak tersedia");
  if (!opd.data) throw new Error("Master OPD CIPTA_BINTAR tidak tersedia.");

  const programResult = await admin
    .from("master_program_layanan")
    .select("id,kode_program,nama_program,is_active")
    .eq("opd_id", opd.data.id)
    .eq("jalur", "PENGUATAN_DASAR")
    .order("nama_program");
  fail(programResult.error, "Program CiptaBintar tidak dapat dibaca");
  if (!programResult.data?.length) return [];

  const ids = programResult.data.map((row) => row.id);
  const [detailsResult, interventionsResult] = await Promise.all([
    admin
      .from("cipta_bintar_program_details")
      .select("program_id,category,petugas_id,petugas,location,start_date,duration_value,duration_unit,capacity,budget_per_unit,facilitation")
      .in("program_id", ids),
    admin
      .from("cipta_bintar_interventions")
      .select("program_id,participant_status")
      .in("program_id", ids)
      .neq("participant_status", "TIDAK_AKTIF"),
  ]);
  fail(detailsResult.error, "Detail program CiptaBintar tidak dapat dibaca");
  fail(interventionsResult.error, "Kapasitas program CiptaBintar tidak dapat dihitung");

  const details = new Map((detailsResult.data ?? []).map((row) => [row.program_id, row]));
  const officerIds = [...new Set((detailsResult.data ?? []).map((row) => row.petugas_id).filter(Boolean))];
  const officerResult = officerIds.length
    ? await admin.from("cipta_bintar_petugas").select("id,nama,wilayah_tugas,lokasi").in("id", officerIds)
    : { data: [], error: null };
  fail(officerResult.error, "Petugas program CIPTA_BINTAR tidak dapat dibaca");
  const officers = new Map((officerResult.data ?? []).map((row) => [row.id, row]));
  const filled = new Map<string, number>();
  for (const row of interventionsResult.data ?? []) {
    filled.set(row.program_id, (filled.get(row.program_id) ?? 0) + 1);
  }

  return programResult.data.map((program) => {
    const detail = details.get(program.id);
    if (!detail?.petugas_id) throw new Error(`Program ${program.kode_program} belum memiliki petugas canonical.`);
    const officer = officers.get(detail.petugas_id);
    if (!officer) throw new Error(`Petugas untuk program ${program.kode_program} tidak ditemukan.`);
    const occupied = filled.get(program.id) ?? 0;
    return {
      id: program.id,
      code: program.kode_program,
      name: program.nama_program,
      category: detail.category,
      petugasId: detail.petugas_id,
      officerName: officer.nama,
      serviceArea: officer.wilayah_tugas ?? "Infrastruktur dan permukiman",
      duration: formatSchedule(detail.start_date, detail.duration_value, detail.duration_unit),
      filled: occupied,
      capacity: detail.capacity,
      status: !program.is_active ? "NONAKTIF" : occupied >= detail.capacity ? "PENUH" : "AKTIF",
      location: detail.location ?? officer.lokasi ?? "Kota Bandung",
      facilitation: detail.facilitation ?? "Fasilitasi perbaikan hunian dan infrastruktur permukiman",
      budgetPerUnit: Number(detail.budget_per_unit),
    };
  });
}

export async function getCiptaBintarReferrals(): Promise<CiptaBintarReferral[]> {
  if (previewEnabled) return [];
  const admin = createAdminClient();
  const opd = await admin.from("master_opd").select("id").eq("kode_opd", "CIPTA_BINTAR").single();
  fail(opd.error, "Master OPD CIPTA_BINTAR tidak tersedia");
  if (!opd.data) throw new Error("Master OPD CIPTA_BINTAR tidak tersedia.");

  const referralResult = await admin
    .from("referral_mbi")
    .select("id,referral_code,warga_id,program_id,status,referral_date,sent_at,target_program,instruction")
    .eq("target_opd_id", opd.data.id)
    .eq("referral_type", "JALUR_MBI")
    .eq("jalur", "PENGUATAN_DASAR")
    .neq("status", "DIBATALKAN")
    .order("created_at", { ascending: false })
    .limit(100);
  fail(referralResult.error, "Referral CiptaBintar tidak dapat dibaca");
  const referrals = referralResult.data ?? [];
  if (!referrals.length) return [];

  const referralIds = referrals.map((row) => row.id);
  const wargaIds = [...new Set(referrals.map((row) => row.warga_id))];
  const interventionResult = await admin
    .from("cipta_bintar_interventions")
    .select("id,referral_id,program_id,petugas_id,petugas,start_date,jenis_bantuan,action_plan,allocated_budget,participant_status,progress_percent,feasibility_status,evaluation_note")
    .in("referral_id", referralIds);
  fail(interventionResult.error, "Intervensi CiptaBintar tidak dapat dibaca");
  const interventions = interventionResult.data ?? [];
  const interventionIds = interventions.map((row) => row.id);
  const programIds = [...new Set([
    ...referrals.map((row) => row.program_id),
    ...interventions.map((row) => row.program_id),
  ].filter(Boolean))];

  const [wargaResult, desilResult, programsResult, detailsResult, eventsResult, outcomesResult, profilesResult] = await Promise.all([
    admin.from("warga").select("id,nik,nama_lengkap,kelurahan").in("id", wargaIds),
    admin.from("penetapan_desil").select("warga_id,desil_dtsen,created_at").in("warga_id", wargaIds).order("created_at", { ascending: false }),
    programIds.length ? admin.from("master_program_layanan").select("id,nama_program").in("id", programIds) : Promise.resolve({ data: [], error: null }),
    programIds.length ? admin.from("cipta_bintar_program_details").select("program_id,petugas_id,petugas").in("program_id", programIds) : Promise.resolve({ data: [], error: null }),
    interventionIds.length ? admin.from("cipta_bintar_intervention_events").select("id,intervention_id,event_type,event_at,note,progress_percent").in("intervention_id", interventionIds).order("event_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
    interventionIds.length ? admin.from("cipta_bintar_realisasi_infrastruktur").select("intervention_id,lokasi_objek,realisasi_anggaran,evaluasi_akhir").in("intervention_id", interventionIds) : Promise.resolve({ data: [], error: null }),
    admin.from("cipta_bintar_beneficiary_profiles").select("warga_id,alamat_objek,kategori_infrastruktur,lokasi_objek").in("warga_id", wargaIds),
  ]);
  for (const [result, context] of [
    [wargaResult, "Warga referral CiptaBintar tidak dapat dibaca"],
    [desilResult, "Desil referral CiptaBintar tidak dapat dibaca"],
    [programsResult, "Program referral CiptaBintar tidak dapat dibaca"],
    [detailsResult, "Detail program referral CiptaBintar tidak dapat dibaca"],
    [eventsResult, "Timeline petugasan CiptaBintar tidak dapat dibaca"],
    [outcomesResult, "Hasil pembinaan CIPTA_BINTAR tidak dapat dibaca"],
    [profilesResult, "Profil penerima referral CIPTA_BINTAR tidak dapat dibaca"],
  ] as const) fail(result.error, context);

  const wargaMap = new Map((wargaResult.data ?? []).map((row) => [row.id, row]));
  const desilMap = new Map<string, number>();
  for (const row of desilResult.data ?? []) {
    if (!desilMap.has(row.warga_id)) desilMap.set(row.warga_id, row.desil_dtsen ?? 0);
  }
  const programMap = new Map((programsResult.data ?? []).map((row) => [row.id, row.nama_program]));
  const detailMap = new Map((detailsResult.data ?? []).map((row) => [row.program_id, row]));
  const interventionMap = new Map(interventions.map((row) => [row.referral_id, row]));
  const outcomeMap = new Map((outcomesResult.data ?? []).map((row) => [row.intervention_id, row]));
  const profileMap = new Map((profilesResult.data ?? []).map((row) => [row.warga_id, row]));
  const eventMap = new Map<string, CiptaBintarTimelineEvent[]>();
  for (const row of eventsResult.data ?? []) {
    const list = eventMap.get(row.intervention_id) ?? [];
    list.push({
      id: row.id,
      type: row.event_type,
      date: formatDate(row.event_at),
      note: row.note ?? "—",
      progress: row.progress_percent,
    });
    eventMap.set(row.intervention_id, list);
  }

  return referrals.flatMap((referral): CiptaBintarReferral[] => {
    const warga = wargaMap.get(referral.warga_id);
    if (!warga) return [];
    const intervention = interventionMap.get(referral.id) ?? null;
    const effectiveProgramId = intervention?.program_id ?? referral.program_id;
    const detail = effectiveProgramId ? detailMap.get(effectiveProgramId) : null;
    const outcome = intervention ? outcomeMap.get(intervention.id) : null;
    const profile = profileMap.get(referral.warga_id);
    return [{
      id: referral.id,
      interventionId: intervention?.id ?? null,
      code: referral.referral_code,
      name: warga.nama_lengkap,
      maskedNik: maskNik(warga.nik),
      date: formatDate(referral.referral_date ?? referral.sent_at),
      programId: effectiveProgramId ?? null,
      program: (effectiveProgramId ? programMap.get(effectiveProgramId) : null) ?? referral.target_program ?? "Belum dipilih",
      petugasId: intervention?.petugas_id ?? detail?.petugas_id ?? null,
      officerName: intervention?.petugas ?? detail?.petugas ?? "Belum dipilih",
      desil: desilMap.get(referral.warga_id) ?? 0,
      kelurahan: warga.kelurahan ?? "—",
      status: mapStatus(referral.status),
      participantStatus: intervention?.participant_status ?? null,
      feasibilityStatus: intervention?.feasibility_status ?? null,
      aidPackage: intervention?.jenis_bantuan ?? "Belum ditentukan",
      actionPlan: intervention?.action_plan ?? referral.instruction ?? "",
      allocatedBudget: intervention ? Number(intervention.allocated_budget) : null,
      progress: intervention?.progress_percent ?? null,
      objectLocation: outcome?.lokasi_objek ?? profile?.lokasi_objek ?? null,
      objectAddress: profile?.alamat_objek ?? `${warga.kelurahan ?? "Kota Bandung"} — alamat objek belum diverifikasi`,
      infrastructureCategory: profile?.kategori_infrastruktur ?? referral.target_program ?? "Belum diklasifikasikan",
      realizationValue: outcome ? Number(outcome.realisasi_anggaran) : null,
      evaluation: outcome?.evaluasi_akhir ?? intervention?.evaluation_note ?? null,
      timeline: intervention ? eventMap.get(intervention.id) ?? [] : [],
    }];
  });
}

export async function getCiptaBintarDashboardData() {
  const referrals = await getCiptaBintarReferrals();
  return {
    referrals,
    summary: {
      newReferrals: referrals.filter((item) => item.status === "PERLU_DIPROSES").length,
      assisted: referrals.filter((item) => item.status === "SEDANG_REHABILITASI").length,
      independent: referrals.filter((item) => item.status === "HUNIAN_LAYAK_SELESAI").length,
    },
    preview: previewEnabled,
  };
}

export async function getCiptaBintarInfrastructureReport() {
  if (previewEnabled) {
    return { beneficiaries: [] as InfrastructureReport[], summary: { independent: 0, totalAchievement: 0, averageAchievement: 0 } };
  }

  const admin = createAdminClient();
  const interventionResult = await admin
    .from("cipta_bintar_interventions")
    .select("id,referral_id,jenis_bantuan,allocated_budget,participant_status,progress_percent");
  fail(interventionResult.error, "Intervensi laporan Cipta Bintar tidak dapat dibaca");
  const interventions = interventionResult.data ?? [];
  if (!interventions.length) {
    return { beneficiaries: [] as InfrastructureReport[], summary: { independent: 0, totalAchievement: 0, averageAchievement: 0 } };
  }

  const interventionIds = interventions.map((row) => row.id);
  const referralIds = interventions.map((row) => row.referral_id);
  const [referralResult, outcomeResult, historyResult] = await Promise.all([
    admin.from("referral_mbi").select("id,referral_code,warga_id").in("id", referralIds),
    admin.from("cipta_bintar_realisasi_infrastruktur")
      .select("id,intervention_id,lokasi_objek,alamat_objek,kategori_infrastruktur,realisasi_anggaran,status_kelayakan")
      .in("intervention_id", interventionIds),
    admin.from("cipta_bintar_laporan_realisasi")
      .select("id,intervention_id,periode,nominal,progress_percent,status")
      .in("intervention_id", interventionIds)
      .order("periode", { ascending: false }),
  ]);
  fail(referralResult.error, "Referral laporan Cipta Bintar tidak dapat dibaca");
  fail(outcomeResult.error, "Realisasi infrastruktur Cipta Bintar tidak dapat dibaca");
  fail(historyResult.error, "Riwayat realisasi Cipta Bintar tidak dapat dibaca");

  const wargaIds = [...new Set((referralResult.data ?? []).map((row) => row.warga_id))];
  const [wargaResult, desilResult, profileResult] = await Promise.all([
    admin.from("warga").select("id,nik,nama_lengkap,kelurahan").in("id", wargaIds),
    admin.from("penetapan_desil").select("warga_id,desil_dtsen,created_at").in("warga_id", wargaIds).order("created_at", { ascending: false }),
    admin.from("cipta_bintar_beneficiary_profiles")
      .select("warga_id,alamat_objek,kategori_infrastruktur,lokasi_objek")
      .in("warga_id", wargaIds),
  ]);
  fail(wargaResult.error, "Warga laporan Cipta Bintar tidak dapat dibaca");
  fail(desilResult.error, "Desil laporan Cipta Bintar tidak dapat dibaca");
  fail(profileResult.error, "Profil objek Cipta Bintar tidak dapat dibaca");

  const referralMap = new Map((referralResult.data ?? []).map((row) => [row.id, row]));
  const wargaMap = new Map((wargaResult.data ?? []).map((row) => [row.id, row]));
  const profileMap = new Map((profileResult.data ?? []).map((row) => [row.warga_id, row]));
  const outcomeMap = new Map((outcomeResult.data ?? []).map((row) => [row.intervention_id, row]));
  const desilMap = new Map<string, number>();
  for (const row of desilResult.data ?? []) {
    if (!desilMap.has(row.warga_id)) desilMap.set(row.warga_id, row.desil_dtsen ?? 0);
  }
  const histories = new Map<string, InfrastructureHistory[]>();
  for (const row of historyResult.data ?? []) {
    const list = histories.get(row.intervention_id) ?? [];
    list.push({
      id: row.id,
      period: formatPeriod(row.periode),
      amount: Number(row.nominal),
      progress: row.progress_percent,
      status: row.status,
    });
    histories.set(row.intervention_id, list);
  }

  const beneficiaries = interventions.flatMap((intervention): InfrastructureReport[] => {
    const referral = referralMap.get(intervention.referral_id);
    const warga = referral ? wargaMap.get(referral.warga_id) : null;
    const profile = referral ? profileMap.get(referral.warga_id) : null;
    const outcome = outcomeMap.get(intervention.id);
    if (!referral || !warga || !profile) return [];
    const history = histories.get(intervention.id) ?? [];
    const realizationValue = outcome ? Number(outcome.realisasi_anggaran) : Number(intervention.allocated_budget);
    return [{
      id: outcome?.id ?? intervention.id,
      referralCode: referral.referral_code,
      name: warga.nama_lengkap,
      maskedNik: maskNik(warga.nik),
      objectAddress: outcome?.alamat_objek ?? profile.alamat_objek,
      objectLocation: outcome?.lokasi_objek ?? profile.lokasi_objek,
      category: outcome?.kategori_infrastruktur ?? profile.kategori_infrastruktur,
      realizationValue,
      status: intervention.participant_status === "HUNIAN_LAYAK_SELESAI" ? "LAYAK" : "DALAM_PENGERJAAN",
      desil: desilMap.get(referral.warga_id) ?? 0,
      kelurahan: warga.kelurahan ?? "—",
      aidPackage: intervention.jenis_bantuan,
      growthPercent: 0,
      progressPercent: intervention.progress_percent,
      history,
    }];
  });

  const totalAchievement = beneficiaries.reduce((sum, beneficiary) => sum + beneficiary.realizationValue, 0);
  const independent = beneficiaries.filter((item) => item.status === "LAYAK").length;
  return {
    beneficiaries,
    summary: {
      independent,
      totalAchievement,
      averageAchievement: beneficiaries.length ? Math.round(totalAchievement / beneficiaries.length) : 0,
    },
  };
}
