import "server-only";

import { maskNik } from "@/lib/privacy/mask-nik";
import { createAdminClient } from "@/lib/supabase/admin";

export type DkppReferralStatus = "PERLU_DIPROSES" | "SEDANG_DIDAMPINGI" | "MANDIRI_SELESAI";
export type DkppParticipantStatus = "AKTIF_PENDAMPINGAN" | "MANDIRI_SELESAI" | "TIDAK_AKTIF";
export type DkppHarvestStatus = "BELUM_PANEN" | "HASIL_MENCUKUPI" | "MEMENUHI_DAN_DIPASARKAN";

export type DkppTimelineEvent = {
  id: string;
  type: "STARTED" | "PROGRESS_UPDATED" | "COMPLETED" | "CANCELLED";
  date: string;
  note: string;
  progress: number | null;
};

export type DkppReferral = {
  id: string;
  interventionId: string | null;
  code: string;
  name: string;
  maskedNik: string;
  date: string;
  programId: string | null;
  program: string;
  penyuluhId: string | null;
  officerName: string;
  desil: number;
  kelurahan: string;
  status: DkppReferralStatus;
  participantStatus: DkppParticipantStatus | null;
  harvestStatus: DkppHarvestStatus | null;
  aidPackage: string;
  actionPlan: string;
  progress: number | null;
  plotLocation: string | null;
  harvestValue: number | null;
  groupName: string;
  foodCategory: string;
  evaluation: string | null;
  timeline: DkppTimelineEvent[];
};

export type DkppProgram = {
  id: string;
  code: string;
  name: string;
  category: string;
  penyuluhId: string;
  officerName: string;
  cluster: string;
  duration: string;
  filled: number;
  capacity: number;
  status: "AKTIF" | "PENUH" | "NONAKTIF";
  location: string;
  facilitation: string;
};

export type DkppOfficer = {
  id: string;
  code: string;
  name: string;
  cluster: string;
  location: string;
};

export type HarvestHistory = {
  id: string;
  period: string;
  amount: number;
  status: "TERVERIFIKASI" | "MENUNGGU_VERIFIKASI";
};

export type FoodReport = {
  id: string;
  referralCode: string;
  name: string;
  maskedNik: string;
  groupName: string;
  plotLocation: string;
  category: string;
  harvestValue: number;
  status: "MANDIRI";
  desil: number;
  kelurahan: string;
  aidPackage: string;
  growthPercent: number;
  history: HarvestHistory[];
};

export const previewEnabled =
  process.env.NODE_ENV !== "production" &&
  process.env.DKPP_PREVIEW_MODE === "true";

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

function mapStatus(status: string): DkppReferralStatus {
  if (status === "SELESAI") return "MANDIRI_SELESAI";
  if (status === "DITERIMA" || status === "DIPROSES") return "SEDANG_DIDAMPINGI";
  return "PERLU_DIPROSES";
}

export async function getDkppOfficers(): Promise<DkppOfficer[]> {
  if (previewEnabled) return [];
  const admin = createAdminClient();
  const result = await admin
    .from("dkpp_penyuluh")
    .select("id,kode,nama,klaster,lokasi")
    .eq("is_active", true)
    .order("nama");
  fail(result.error, "Master penyuluh DKPP tidak tersedia");
  return (result.data ?? []).map((row) => ({
    id: row.id,
    code: row.kode,
    name: row.nama,
    cluster: row.klaster ?? "Penyuluh pangan",
    location: row.lokasi ?? "Kota Bandung",
  }));
}

export async function getDkppPrograms(): Promise<DkppProgram[]> {
  if (previewEnabled) return [];
  const admin = createAdminClient();
  const opd = await admin.from("master_opd").select("id").eq("kode_opd", "DKPP").single();
  fail(opd.error, "Master OPD DKPP tidak tersedia");
  if (!opd.data) throw new Error("Master OPD DKPP tidak tersedia.");

  const programResult = await admin
    .from("master_program_layanan")
    .select("id,kode_program,nama_program,is_active")
    .eq("opd_id", opd.data.id)
    .eq("jalur", "WIRAUSAHA")
    .order("nama_program");
  fail(programResult.error, "Program Dkpp tidak dapat dibaca");
  if (!programResult.data?.length) return [];

  const ids = programResult.data.map((row) => row.id);
  const [detailsResult, interventionsResult] = await Promise.all([
    admin
      .from("dkpp_program_details")
      .select("program_id,category,penyuluh_id,penyuluh,location,duration_value,duration_unit,capacity,facilitation")
      .in("program_id", ids),
    admin
      .from("dkpp_interventions")
      .select("program_id,participant_status")
      .in("program_id", ids)
      .neq("participant_status", "TIDAK_AKTIF"),
  ]);
  fail(detailsResult.error, "Detail program Dkpp tidak dapat dibaca");
  fail(interventionsResult.error, "Kapasitas program Dkpp tidak dapat dihitung");

  const details = new Map((detailsResult.data ?? []).map((row) => [row.program_id, row]));
  const officerIds = [...new Set((detailsResult.data ?? []).map((row) => row.penyuluh_id).filter(Boolean))];
  const officerResult = officerIds.length
    ? await admin.from("dkpp_penyuluh").select("id,nama,klaster,lokasi").in("id", officerIds)
    : { data: [], error: null };
  fail(officerResult.error, "Penyuluh program DKPP tidak dapat dibaca");
  const officers = new Map((officerResult.data ?? []).map((row) => [row.id, row]));
  const filled = new Map<string, number>();
  for (const row of interventionsResult.data ?? []) {
    filled.set(row.program_id, (filled.get(row.program_id) ?? 0) + 1);
  }

  return programResult.data.map((program) => {
    const detail = details.get(program.id);
    if (!detail?.penyuluh_id) throw new Error(`Program ${program.kode_program} belum memiliki penyuluh canonical.`);
    const officer = officers.get(detail.penyuluh_id);
    if (!officer) throw new Error(`Penyuluh untuk program ${program.kode_program} tidak ditemukan.`);
    const occupied = filled.get(program.id) ?? 0;
    return {
      id: program.id,
      code: program.kode_program,
      name: program.nama_program,
      category: detail.category,
      penyuluhId: detail.penyuluh_id,
      officerName: officer.nama,
      cluster: officer.klaster ?? "Penyuluh pangan",
      duration: `${detail.duration_value} ${detail.duration_unit.charAt(0)}${detail.duration_unit.slice(1).toLowerCase()}`,
      filled: occupied,
      capacity: detail.capacity,
      status: !program.is_active ? "NONAKTIF" : occupied >= detail.capacity ? "PENUH" : "AKTIF",
      location: detail.location ?? officer.lokasi ?? "Kota Bandung",
      facilitation: detail.facilitation ?? "Bantuan bibit, sarana budidaya, dan pendampingan pangan",
    };
  });
}

export async function getDkppReferrals(): Promise<DkppReferral[]> {
  if (previewEnabled) return [];
  const admin = createAdminClient();
  const opd = await admin.from("master_opd").select("id").eq("kode_opd", "DKPP").single();
  fail(opd.error, "Master OPD DKPP tidak tersedia");
  if (!opd.data) throw new Error("Master OPD DKPP tidak tersedia.");

  const referralResult = await admin
    .from("referral_mbi")
    .select("id,referral_code,warga_id,program_id,status,referral_date,sent_at,target_program,instruction")
    .eq("target_opd_id", opd.data.id)
    .eq("referral_type", "JALUR_MBI")
    .eq("jalur", "WIRAUSAHA")
    .neq("status", "DIBATALKAN")
    .order("created_at", { ascending: false })
    .limit(100);
  fail(referralResult.error, "Referral Dkpp tidak dapat dibaca");
  const referrals = referralResult.data ?? [];
  if (!referrals.length) return [];

  const referralIds = referrals.map((row) => row.id);
  const wargaIds = [...new Set(referrals.map((row) => row.warga_id))];
  const interventionResult = await admin
    .from("dkpp_interventions")
    .select("id,referral_id,program_id,penyuluh_id,penyuluh,start_date,jenis_bantuan,action_plan,participant_status,progress_percent,harvest_status,evaluation_note")
    .in("referral_id", referralIds);
  fail(interventionResult.error, "Intervensi Dkpp tidak dapat dibaca");
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
    programIds.length ? admin.from("dkpp_program_details").select("program_id,penyuluh_id,penyuluh").in("program_id", programIds) : Promise.resolve({ data: [], error: null }),
    interventionIds.length ? admin.from("dkpp_intervention_events").select("id,intervention_id,event_type,event_at,note,progress_percent").in("intervention_id", interventionIds).order("event_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
    interventionIds.length ? admin.from("dkpp_ketahanan_pangan").select("intervention_id,lokasi_demplot,nilai_panen,evaluasi_akhir").in("intervention_id", interventionIds) : Promise.resolve({ data: [], error: null }),
    admin.from("dkpp_beneficiary_profiles").select("warga_id,nama_kelompok,kategori_pangan,lokasi_demplot").in("warga_id", wargaIds),
  ]);
  for (const [result, context] of [
    [wargaResult, "Warga referral Dkpp tidak dapat dibaca"],
    [desilResult, "Desil referral Dkpp tidak dapat dibaca"],
    [programsResult, "Program referral Dkpp tidak dapat dibaca"],
    [detailsResult, "Detail program referral Dkpp tidak dapat dibaca"],
    [eventsResult, "Timeline pendampingan Dkpp tidak dapat dibaca"],
    [outcomesResult, "Hasil ketahanan pangan DKPP tidak dapat dibaca"],
    [profilesResult, "Profil penerima referral DKPP tidak dapat dibaca"],
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
  const eventMap = new Map<string, DkppTimelineEvent[]>();
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

  return referrals.flatMap((referral): DkppReferral[] => {
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
      penyuluhId: intervention?.penyuluh_id ?? detail?.penyuluh_id ?? null,
      officerName: intervention?.penyuluh ?? detail?.penyuluh ?? "Belum dipilih",
      desil: desilMap.get(referral.warga_id) ?? 0,
      kelurahan: warga.kelurahan ?? "—",
      status: mapStatus(referral.status),
      participantStatus: intervention?.participant_status ?? null,
      harvestStatus: intervention?.harvest_status ?? null,
      aidPackage: intervention?.jenis_bantuan ?? "Belum ditentukan",
      actionPlan: intervention?.action_plan ?? referral.instruction ?? "",
      progress: intervention?.progress_percent ?? null,
      plotLocation: outcome?.lokasi_demplot ?? profile?.lokasi_demplot ?? null,
      groupName: profile?.nama_kelompok ?? "Keluarga / kelompok belum didata",
      foodCategory: profile?.kategori_pangan ?? referral.target_program ?? "Belum diklasifikasikan",
      harvestValue: outcome ? Number(outcome.nilai_panen) : null,
      evaluation: outcome?.evaluasi_akhir ?? intervention?.evaluation_note ?? null,
      timeline: intervention ? eventMap.get(intervention.id) ?? [] : [],
    }];
  });
}

export async function getDkppDashboardData() {
  const referrals = await getDkppReferrals();
  return {
    referrals,
    summary: {
      newReferrals: referrals.filter((item) => item.status === "PERLU_DIPROSES").length,
      assisted: referrals.filter((item) => item.status === "SEDANG_DIDAMPINGI").length,
      independent: referrals.filter((item) => item.status === "MANDIRI_SELESAI").length,
    },
    preview: previewEnabled,
  };
}

export async function getDkppHarvestReport() {
  if (previewEnabled) {
    return { beneficiaries: [] as FoodReport[], summary: { independent: 0, totalHarvest: 0, averageHarvest: 0 } };
  }
  const admin = createAdminClient();
  const outcomeResult = await admin
    .from("dkpp_ketahanan_pangan")
    .select("id,intervention_id,lokasi_demplot,nama_kelompok,kategori_pangan,nilai_panen,status_hasil");
  fail(outcomeResult.error, "Laporan hasil pangan DKPP tidak dapat dibaca");
  const outcomes = outcomeResult.data ?? [];
  if (!outcomes.length) {
    return { beneficiaries: [] as FoodReport[], summary: { independent: 0, totalHarvest: 0, averageHarvest: 0 } };
  }

  const interventionIds = outcomes.map((row) => row.intervention_id);
  const interventionResult = await admin
    .from("dkpp_interventions")
    .select("id,referral_id,program_id")
    .in("id", interventionIds);
  fail(interventionResult.error, "Intervensi laporan Dkpp tidak dapat dibaca");
  const interventions = interventionResult.data ?? [];
  const referralIds = interventions.map((row) => row.referral_id);
  const [referralResult, historyResult] = await Promise.all([
    admin.from("referral_mbi").select("id,referral_code,warga_id").in("id", referralIds),
    admin.from("dkpp_laporan_panen").select("id,intervention_id,periode,nominal,status").in("intervention_id", interventionIds).order("periode", { ascending: false }),
  ]);
  fail(referralResult.error, "Referral laporan Dkpp tidak dapat dibaca");
  fail(historyResult.error, "Riwayat nilai panen DKPP tidak dapat dibaca");
  const wargaIds = [...new Set((referralResult.data ?? []).map((row) => row.warga_id))];
  const [wargaResult, desilResult] = await Promise.all([
    admin.from("warga").select("id,nik,nama_lengkap,kelurahan").in("id", wargaIds),
    admin.from("penetapan_desil").select("warga_id,desil_dtsen,created_at").in("warga_id", wargaIds).order("created_at", { ascending: false }),
  ]);
  fail(wargaResult.error, "Warga laporan Dkpp tidak dapat dibaca");
  fail(desilResult.error, "Desil laporan Dkpp tidak dapat dibaca");

  const interventionMap = new Map(interventions.map((row) => [row.id, row]));
  const referralMap = new Map((referralResult.data ?? []).map((row) => [row.id, row]));
  const wargaMap = new Map((wargaResult.data ?? []).map((row) => [row.id, row]));
  const desilMap = new Map<string, number>();
  for (const row of desilResult.data ?? []) if (!desilMap.has(row.warga_id)) desilMap.set(row.warga_id, row.desil_dtsen ?? 0);
  const histories = new Map<string, HarvestHistory[]>();
  for (const row of historyResult.data ?? []) {
    const list = histories.get(row.intervention_id) ?? [];
    list.push({ id: row.id, period: formatPeriod(row.periode), amount: Number(row.nominal), status: row.status });
    histories.set(row.intervention_id, list);
  }

  const beneficiaries = outcomes.flatMap((outcome): FoodReport[] => {
    const intervention = interventionMap.get(outcome.intervention_id);
    const referral = intervention ? referralMap.get(intervention.referral_id) : null;
    const warga = referral ? wargaMap.get(referral.warga_id) : null;
    if (!intervention || !referral || !warga) return [];
    const history = histories.get(intervention.id) ?? [];
    const newest = history[0]?.amount ?? Number(outcome.nilai_panen);
    const oldest = history.at(-1)?.amount ?? newest;
    const growthPercent = oldest > 0 ? Math.round(((newest - oldest) / oldest) * 100) : 0;
    return [{
      id: outcome.id,
      referralCode: referral.referral_code,
      name: warga.nama_lengkap,
      maskedNik: maskNik(warga.nik),
      groupName: outcome.nama_kelompok,
      plotLocation: outcome.lokasi_demplot,
      category: outcome.kategori_pangan,
      harvestValue: Number(outcome.nilai_panen),
      status: "MANDIRI",
      desil: desilMap.get(referral.warga_id) ?? 0,
      kelurahan: warga.kelurahan ?? "—",
      aidPackage: outcome.status_hasil ?? "Mandiri pangan",
      growthPercent,
      history,
    }];
  });
  const totalHarvest = beneficiaries.reduce((sum, beneficiary) => sum + beneficiary.harvestValue, 0);
  return {
    beneficiaries,
    summary: {
      independent: beneficiaries.length,
      totalHarvest,
      averageHarvest: beneficiaries.length ? Math.round(totalHarvest / beneficiaries.length) : 0,
    },
  };
}
