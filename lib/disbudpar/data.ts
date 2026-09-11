import "server-only";

import { maskNik } from "@/lib/privacy/mask-nik";
import { createAdminClient } from "@/lib/supabase/admin";

export type DisbudparReferralStatus = "PERLU_DIPROSES" | "SEDANG_DIDAMPINGI" | "MANDIRI_SELESAI";
export type DisbudparParticipantStatus = "AKTIF_PENDAMPINGAN" | "MANDIRI_SELESAI" | "TIDAK_AKTIF";
export type DisbudparCreativeResultStatus = "BELUM_AKTIF" | "AKTIF_TERBATAS" | "AKTIF_TAMPIL_PRODUKSI_RUTIN";

export type DisbudparTimelineEvent = {
  id: string;
  type: "STARTED" | "PROGRESS_UPDATED" | "COMPLETED" | "CANCELLED";
  date: string;
  note: string;
  progress: number | null;
};

export type DisbudparReferral = {
  id: string;
  interventionId: string | null;
  code: string;
  name: string;
  maskedNik: string;
  date: string;
  programId: string | null;
  program: string;
  pendampingId: string | null;
  officerName: string;
  desil: number;
  kelurahan: string;
  status: DisbudparReferralStatus;
  participantStatus: DisbudparParticipantStatus | null;
  creativeResultStatus: DisbudparCreativeResultStatus | null;
  aidPackage: string;
  actionPlan: string;
  progress: number | null;
  venueLocation: string | null;
  achievementValue: number | null;
  groupName: string;
  creativeSubsector: string;
  evaluation: string | null;
  timeline: DisbudparTimelineEvent[];
};

export type DisbudparProgram = {
  id: string;
  code: string;
  name: string;
  category: string;
  pendampingId: string;
  officerName: string;
  cluster: string;
  duration: string;
  filled: number;
  capacity: number;
  status: "AKTIF" | "PENUH" | "NONAKTIF";
  location: string;
  facilitation: string;
};

export type DisbudparOfficer = {
  id: string;
  code: string;
  name: string;
  cluster: string;
  location: string;
};

export type CreativeHistory = {
  id: string;
  period: string;
  amount: number;
  status: "TERVERIFIKASI" | "MENUNGGU_VERIFIKASI";
};

export type CreativeReport = {
  id: string;
  referralCode: string;
  name: string;
  maskedNik: string;
  groupName: string;
  venueLocation: string;
  category: string;
  achievementValue: number;
  status: "MANDIRI";
  desil: number;
  kelurahan: string;
  aidPackage: string;
  growthPercent: number;
  history: CreativeHistory[];
};

export const previewEnabled =
  process.env.NODE_ENV !== "production" &&
  process.env.DISBUDPAR_PREVIEW_MODE === "true";

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

function mapStatus(status: string): DisbudparReferralStatus {
  if (status === "SELESAI") return "MANDIRI_SELESAI";
  if (status === "DITERIMA" || status === "DIPROSES") return "SEDANG_DIDAMPINGI";
  return "PERLU_DIPROSES";
}

export async function getDisbudparOfficers(): Promise<DisbudparOfficer[]> {
  if (previewEnabled) return [];
  const admin = createAdminClient();
  const result = await admin
    .from("disbudpar_pendamping")
    .select("id,kode,nama,klaster,lokasi")
    .eq("is_active", true)
    .order("nama");
  fail(result.error, "Master pendamping DISBUDPAR tidak tersedia");
  return (result.data ?? []).map((row) => ({
    id: row.id,
    code: row.kode,
    name: row.nama,
    cluster: row.klaster ?? "Pendamping ekraf dan seni",
    location: row.lokasi ?? "Kota Bandung",
  }));
}

export async function getDisbudparPrograms(): Promise<DisbudparProgram[]> {
  if (previewEnabled) return [];
  const admin = createAdminClient();
  const opd = await admin.from("master_opd").select("id").eq("kode_opd", "DISBUDPAR").single();
  fail(opd.error, "Master OPD DISBUDPAR tidak tersedia");
  if (!opd.data) throw new Error("Master OPD DISBUDPAR tidak tersedia.");

  const programResult = await admin
    .from("master_program_layanan")
    .select("id,kode_program,nama_program,is_active")
    .eq("opd_id", opd.data.id)
    .eq("jalur", "WIRAUSAHA")
    .order("nama_program");
  fail(programResult.error, "Program Disbudpar tidak dapat dibaca");
  if (!programResult.data?.length) return [];

  const ids = programResult.data.map((row) => row.id);
  const [detailsResult, interventionsResult] = await Promise.all([
    admin
      .from("disbudpar_program_details")
      .select("program_id,category,pendamping_id,pendamping,location,duration_value,duration_unit,capacity,facilitation")
      .in("program_id", ids),
    admin
      .from("disbudpar_interventions")
      .select("program_id,participant_status")
      .in("program_id", ids)
      .neq("participant_status", "TIDAK_AKTIF"),
  ]);
  fail(detailsResult.error, "Detail program Disbudpar tidak dapat dibaca");
  fail(interventionsResult.error, "Kapasitas program Disbudpar tidak dapat dihitung");

  const details = new Map((detailsResult.data ?? []).map((row) => [row.program_id, row]));
  const officerIds = [...new Set((detailsResult.data ?? []).map((row) => row.pendamping_id).filter(Boolean))];
  const officerResult = officerIds.length
    ? await admin.from("disbudpar_pendamping").select("id,nama,klaster,lokasi").in("id", officerIds)
    : { data: [], error: null };
  fail(officerResult.error, "Pendamping program DISBUDPAR tidak dapat dibaca");
  const officers = new Map((officerResult.data ?? []).map((row) => [row.id, row]));
  const filled = new Map<string, number>();
  for (const row of interventionsResult.data ?? []) {
    filled.set(row.program_id, (filled.get(row.program_id) ?? 0) + 1);
  }

  return programResult.data.map((program) => {
    const detail = details.get(program.id);
    if (!detail?.pendamping_id) throw new Error(`Program ${program.kode_program} belum memiliki pendamping canonical.`);
    const officer = officers.get(detail.pendamping_id);
    if (!officer) throw new Error(`Pendamping untuk program ${program.kode_program} tidak ditemukan.`);
    const occupied = filled.get(program.id) ?? 0;
    return {
      id: program.id,
      code: program.kode_program,
      name: program.nama_program,
      category: detail.category,
      pendampingId: detail.pendamping_id,
      officerName: officer.nama,
      cluster: officer.klaster ?? "Pendamping ekraf dan seni",
      duration: `${detail.duration_value} ${detail.duration_unit.charAt(0)}${detail.duration_unit.slice(1).toLowerCase()}`,
      filled: occupied,
      capacity: detail.capacity,
      status: !program.is_active ? "NONAKTIF" : occupied >= detail.capacity ? "PENUH" : "AKTIF",
      location: detail.location ?? officer.lokasi ?? "Kota Bandung",
      facilitation: detail.facilitation ?? "Fasilitasi peralatan seni dan pendampingan ekonomi kreatif",
    };
  });
}

export async function getDisbudparReferrals(): Promise<DisbudparReferral[]> {
  if (previewEnabled) return [];
  const admin = createAdminClient();
  const opd = await admin.from("master_opd").select("id").eq("kode_opd", "DISBUDPAR").single();
  fail(opd.error, "Master OPD DISBUDPAR tidak tersedia");
  if (!opd.data) throw new Error("Master OPD DISBUDPAR tidak tersedia.");

  const referralResult = await admin
    .from("referral_mbi")
    .select("id,referral_code,warga_id,program_id,status,referral_date,sent_at,target_program,instruction")
    .eq("target_opd_id", opd.data.id)
    .eq("referral_type", "JALUR_MBI")
    .eq("jalur", "WIRAUSAHA")
    .neq("status", "DIBATALKAN")
    .order("created_at", { ascending: false })
    .limit(100);
  fail(referralResult.error, "Referral Disbudpar tidak dapat dibaca");
  const referrals = referralResult.data ?? [];
  if (!referrals.length) return [];

  const referralIds = referrals.map((row) => row.id);
  const wargaIds = [...new Set(referrals.map((row) => row.warga_id))];
  const interventionResult = await admin
    .from("disbudpar_interventions")
    .select("id,referral_id,program_id,pendamping_id,pendamping,start_date,jenis_bantuan,action_plan,participant_status,progress_percent,creative_result_status,evaluation_note")
    .in("referral_id", referralIds);
  fail(interventionResult.error, "Intervensi Disbudpar tidak dapat dibaca");
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
    programIds.length ? admin.from("disbudpar_program_details").select("program_id,pendamping_id,pendamping").in("program_id", programIds) : Promise.resolve({ data: [], error: null }),
    interventionIds.length ? admin.from("disbudpar_intervention_events").select("id,intervention_id,event_type,event_at,note,progress_percent").in("intervention_id", interventionIds).order("event_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
    interventionIds.length ? admin.from("disbudpar_kemandirian_ekraf").select("intervention_id,lokasi_sanggar,capaian_omzet_nilai_tampil,evaluasi_akhir").in("intervention_id", interventionIds) : Promise.resolve({ data: [], error: null }),
    admin.from("disbudpar_beneficiary_profiles").select("warga_id,nama_kelompok,subsektor_ekraf,lokasi_sanggar").in("warga_id", wargaIds),
  ]);
  for (const [result, context] of [
    [wargaResult, "Warga referral Disbudpar tidak dapat dibaca"],
    [desilResult, "Desil referral Disbudpar tidak dapat dibaca"],
    [programsResult, "Program referral Disbudpar tidak dapat dibaca"],
    [detailsResult, "Detail program referral Disbudpar tidak dapat dibaca"],
    [eventsResult, "Timeline pendampingan Disbudpar tidak dapat dibaca"],
    [outcomesResult, "Hasil pembinaan DISBUDPAR tidak dapat dibaca"],
    [profilesResult, "Profil penerima referral DISBUDPAR tidak dapat dibaca"],
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
  const eventMap = new Map<string, DisbudparTimelineEvent[]>();
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

  return referrals.flatMap((referral): DisbudparReferral[] => {
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
      pendampingId: intervention?.pendamping_id ?? detail?.pendamping_id ?? null,
      officerName: intervention?.pendamping ?? detail?.pendamping ?? "Belum dipilih",
      desil: desilMap.get(referral.warga_id) ?? 0,
      kelurahan: warga.kelurahan ?? "—",
      status: mapStatus(referral.status),
      participantStatus: intervention?.participant_status ?? null,
      creativeResultStatus: intervention?.creative_result_status ?? null,
      aidPackage: intervention?.jenis_bantuan ?? "Belum ditentukan",
      actionPlan: intervention?.action_plan ?? referral.instruction ?? "",
      progress: intervention?.progress_percent ?? null,
      venueLocation: outcome?.lokasi_sanggar ?? profile?.lokasi_sanggar ?? null,
      groupName: profile?.nama_kelompok ?? "Kelompok / sanggar belum didata",
      creativeSubsector: profile?.subsektor_ekraf ?? referral.target_program ?? "Belum diklasifikasikan",
      achievementValue: outcome ? Number(outcome.capaian_omzet_nilai_tampil) : null,
      evaluation: outcome?.evaluasi_akhir ?? intervention?.evaluation_note ?? null,
      timeline: intervention ? eventMap.get(intervention.id) ?? [] : [],
    }];
  });
}

export async function getDisbudparDashboardData() {
  const referrals = await getDisbudparReferrals();
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

export async function getDisbudparCreativeReport() {
  if (previewEnabled) {
    return { beneficiaries: [] as CreativeReport[], summary: { independent: 0, totalAchievement: 0, averageAchievement: 0 } };
  }
  const admin = createAdminClient();
  const outcomeResult = await admin
    .from("disbudpar_kemandirian_ekraf")
    .select("id,intervention_id,lokasi_sanggar,nama_kelompok,subsektor_ekraf,capaian_omzet_nilai_tampil,status_hasil");
  fail(outcomeResult.error, "Laporan pembinaan DISBUDPAR tidak dapat dibaca");
  const outcomes = outcomeResult.data ?? [];
  if (!outcomes.length) {
    return { beneficiaries: [] as CreativeReport[], summary: { independent: 0, totalAchievement: 0, averageAchievement: 0 } };
  }

  const interventionIds = outcomes.map((row) => row.intervention_id);
  const interventionResult = await admin
    .from("disbudpar_interventions")
    .select("id,referral_id,program_id")
    .in("id", interventionIds);
  fail(interventionResult.error, "Intervensi laporan Disbudpar tidak dapat dibaca");
  const interventions = interventionResult.data ?? [];
  const referralIds = interventions.map((row) => row.referral_id);
  const [referralResult, historyResult] = await Promise.all([
    admin.from("referral_mbi").select("id,referral_code,warga_id").in("id", referralIds),
    admin.from("disbudpar_laporan_pembinaan").select("id,intervention_id,periode,nominal,status").in("intervention_id", interventionIds).order("periode", { ascending: false }),
  ]);
  fail(referralResult.error, "Referral laporan Disbudpar tidak dapat dibaca");
  fail(historyResult.error, "Riwayat capaian pembinaan DISBUDPAR tidak dapat dibaca");
  const wargaIds = [...new Set((referralResult.data ?? []).map((row) => row.warga_id))];
  const [wargaResult, desilResult] = await Promise.all([
    admin.from("warga").select("id,nik,nama_lengkap,kelurahan").in("id", wargaIds),
    admin.from("penetapan_desil").select("warga_id,desil_dtsen,created_at").in("warga_id", wargaIds).order("created_at", { ascending: false }),
  ]);
  fail(wargaResult.error, "Warga laporan Disbudpar tidak dapat dibaca");
  fail(desilResult.error, "Desil laporan Disbudpar tidak dapat dibaca");

  const interventionMap = new Map(interventions.map((row) => [row.id, row]));
  const referralMap = new Map((referralResult.data ?? []).map((row) => [row.id, row]));
  const wargaMap = new Map((wargaResult.data ?? []).map((row) => [row.id, row]));
  const desilMap = new Map<string, number>();
  for (const row of desilResult.data ?? []) if (!desilMap.has(row.warga_id)) desilMap.set(row.warga_id, row.desil_dtsen ?? 0);
  const histories = new Map<string, CreativeHistory[]>();
  for (const row of historyResult.data ?? []) {
    const list = histories.get(row.intervention_id) ?? [];
    list.push({ id: row.id, period: formatPeriod(row.periode), amount: Number(row.nominal), status: row.status });
    histories.set(row.intervention_id, list);
  }

  const beneficiaries = outcomes.flatMap((outcome): CreativeReport[] => {
    const intervention = interventionMap.get(outcome.intervention_id);
    const referral = intervention ? referralMap.get(intervention.referral_id) : null;
    const warga = referral ? wargaMap.get(referral.warga_id) : null;
    if (!intervention || !referral || !warga) return [];
    const history = histories.get(intervention.id) ?? [];
    const newest = history[0]?.amount ?? Number(outcome.capaian_omzet_nilai_tampil);
    const oldest = history.at(-1)?.amount ?? newest;
    const growthPercent = oldest > 0 ? Math.round(((newest - oldest) / oldest) * 100) : 0;
    return [{
      id: outcome.id,
      referralCode: referral.referral_code,
      name: warga.nama_lengkap,
      maskedNik: maskNik(warga.nik),
      groupName: outcome.nama_kelompok,
      venueLocation: outcome.lokasi_sanggar,
      category: outcome.subsektor_ekraf,
      achievementValue: Number(outcome.capaian_omzet_nilai_tampil),
      status: "MANDIRI",
      desil: desilMap.get(referral.warga_id) ?? 0,
      kelurahan: warga.kelurahan ?? "—",
      aidPackage: outcome.status_hasil ?? "Aktif tampil dan produksi rutin",
      growthPercent,
      history,
    }];
  });
  const totalAchievement = beneficiaries.reduce((sum, beneficiary) => sum + beneficiary.achievementValue, 0);
  return {
    beneficiaries,
    summary: {
      independent: beneficiaries.length,
      totalAchievement,
      averageAchievement: beneficiaries.length ? Math.round(totalAchievement / beneficiaries.length) : 0,
    },
  };
}
