import "server-only";

import { maskNik } from "@/lib/privacy/mask-nik";
import { createAdminClient } from "@/lib/supabase/admin";

export type DisdaginReferralStatus = "PERLU_DIPROSES" | "SEDANG_DIDAMPINGI" | "MANDIRI_SELESAI";
export type DisdaginParticipantStatus = "AKTIF_PENDAMPINGAN" | "MANDIRI_SELESAI" | "TIDAK_AKTIF";
export type DisdaginLegalStatus = "BELUM" | "PROSES_NIB_HALAL" | "LEGAL";

export type DisdaginTimelineEvent = {
  id: string;
  type: "STARTED" | "PROGRESS_UPDATED" | "COMPLETED" | "CANCELLED";
  date: string;
  note: string;
  progress: number | null;
};

export type DisdaginReferral = {
  id: string;
  interventionId: string | null;
  code: string;
  name: string;
  maskedNik: string;
  date: string;
  programId: string | null;
  program: string;
  pendampingId: string | null;
  consultant: string;
  desil: number;
  kelurahan: string;
  status: DisdaginReferralStatus;
  participantStatus: DisdaginParticipantStatus | null;
  legalStatus: DisdaginLegalStatus | null;
  stimulus: string;
  actionPlan: string;
  progress: number | null;
  nib: string | null;
  monthlyRevenue: number | null;
  businessName: string;
  businessCategory: string;
  evaluation: string | null;
  timeline: DisdaginTimelineEvent[];
};

export type DisdaginProgram = {
  id: string;
  code: string;
  name: string;
  category: string;
  pendampingId: string;
  consultant: string;
  cluster: string;
  duration: string;
  filled: number;
  capacity: number;
  status: "AKTIF" | "PENUH" | "NONAKTIF";
  location: string;
  facilitation: string;
};

export type DisdaginMentor = {
  id: string;
  code: string;
  name: string;
  cluster: string;
  location: string;
};

export type RevenueHistory = {
  id: string;
  period: string;
  amount: number;
  status: "TERVERIFIKASI" | "MENUNGGU_VERIFIKASI";
};

export type BusinessReport = {
  id: string;
  referralCode: string;
  name: string;
  maskedNik: string;
  businessName: string;
  nib: string;
  category: string;
  monthlyRevenue: number;
  status: "MANDIRI";
  desil: number;
  kelurahan: string;
  stimulus: string;
  growthPercent: number;
  history: RevenueHistory[];
};

export const previewEnabled =
  process.env.NODE_ENV !== "production" &&
  process.env.DISDAGIN_PREVIEW_MODE === "true";

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

function mapStatus(status: string): DisdaginReferralStatus {
  if (status === "SELESAI") return "MANDIRI_SELESAI";
  if (status === "DITERIMA" || status === "DIPROSES") return "SEDANG_DIDAMPINGI";
  return "PERLU_DIPROSES";
}

export async function getDisdaginMentors(): Promise<DisdaginMentor[]> {
  if (previewEnabled) return [];
  const admin = createAdminClient();
  const result = await admin
    .from("disdagin_pendamping")
    .select("id,kode,nama,klaster,lokasi")
    .eq("is_active", true)
    .order("nama");
  fail(result.error, "Master pendamping Disdagin tidak tersedia");
  return (result.data ?? []).map((row) => ({
    id: row.id,
    code: row.kode,
    name: row.nama,
    cluster: row.klaster ?? "Lintas kategori",
    location: row.lokasi ?? "Kota Bandung",
  }));
}

export async function getDisdaginPrograms(): Promise<DisdaginProgram[]> {
  if (previewEnabled) return [];
  const admin = createAdminClient();
  const opd = await admin.from("master_opd").select("id").eq("kode_opd", "DISDAGIN").single();
  fail(opd.error, "Master OPD DISDAGIN tidak tersedia");
  if (!opd.data) throw new Error("Master OPD DISDAGIN tidak tersedia.");

  const programResult = await admin
    .from("master_program_layanan")
    .select("id,kode_program,nama_program,is_active")
    .eq("opd_id", opd.data.id)
    .eq("jalur", "WIRAUSAHA")
    .order("nama_program");
  fail(programResult.error, "Program Disdagin tidak dapat dibaca");
  if (!programResult.data?.length) return [];

  const ids = programResult.data.map((row) => row.id);
  const [detailsResult, interventionsResult] = await Promise.all([
    admin
      .from("disdagin_program_details")
      .select("program_id,category,pendamping_id,consultant,location,duration_value,duration_unit,capacity,facilitation")
      .in("program_id", ids),
    admin
      .from("disdagin_interventions")
      .select("program_id,participant_status")
      .in("program_id", ids)
      .neq("participant_status", "TIDAK_AKTIF"),
  ]);
  fail(detailsResult.error, "Detail program Disdagin tidak dapat dibaca");
  fail(interventionsResult.error, "Kapasitas program Disdagin tidak dapat dihitung");

  const details = new Map((detailsResult.data ?? []).map((row) => [row.program_id, row]));
  const mentorIds = [...new Set((detailsResult.data ?? []).map((row) => row.pendamping_id).filter(Boolean))];
  const mentorResult = mentorIds.length
    ? await admin.from("disdagin_pendamping").select("id,nama,klaster,lokasi").in("id", mentorIds)
    : { data: [], error: null };
  fail(mentorResult.error, "Pendamping program Disdagin tidak dapat dibaca");
  const mentors = new Map((mentorResult.data ?? []).map((row) => [row.id, row]));
  const filled = new Map<string, number>();
  for (const row of interventionsResult.data ?? []) {
    filled.set(row.program_id, (filled.get(row.program_id) ?? 0) + 1);
  }

  return programResult.data.map((program) => {
    const detail = details.get(program.id);
    if (!detail?.pendamping_id) throw new Error(`Program ${program.kode_program} belum memiliki pendamping canonical.`);
    const mentor = mentors.get(detail.pendamping_id);
    if (!mentor) throw new Error(`Pendamping untuk program ${program.kode_program} tidak ditemukan.`);
    const occupied = filled.get(program.id) ?? 0;
    return {
      id: program.id,
      code: program.kode_program,
      name: program.nama_program,
      category: detail.category,
      pendampingId: detail.pendamping_id,
      consultant: mentor.nama,
      cluster: mentor.klaster ?? "Lintas kategori",
      duration: `${detail.duration_value} ${detail.duration_unit.charAt(0)}${detail.duration_unit.slice(1).toLowerCase()}`,
      filled: occupied,
      capacity: detail.capacity,
      status: !program.is_active ? "NONAKTIF" : occupied >= detail.capacity ? "PENUH" : "AKTIF",
      location: detail.location ?? mentor.lokasi ?? "Kota Bandung",
      facilitation: detail.facilitation ?? "Fasilitasi pameran, display retail, dan akses pasar",
    };
  });
}

export async function getDisdaginReferrals(): Promise<DisdaginReferral[]> {
  if (previewEnabled) return [];
  const admin = createAdminClient();
  const opd = await admin.from("master_opd").select("id").eq("kode_opd", "DISDAGIN").single();
  fail(opd.error, "Master OPD DISDAGIN tidak tersedia");
  if (!opd.data) throw new Error("Master OPD DISDAGIN tidak tersedia.");

  const referralResult = await admin
    .from("referral_mbi")
    .select("id,referral_code,warga_id,program_id,status,referral_date,sent_at,target_program,instruction")
    .eq("target_opd_id", opd.data.id)
    .eq("referral_type", "JALUR_MBI")
    .eq("jalur", "WIRAUSAHA")
    .neq("status", "DIBATALKAN")
    .order("created_at", { ascending: false })
    .limit(100);
  fail(referralResult.error, "Referral Disdagin tidak dapat dibaca");
  const referrals = referralResult.data ?? [];
  if (!referrals.length) return [];

  const referralIds = referrals.map((row) => row.id);
  const wargaIds = [...new Set(referrals.map((row) => row.warga_id))];
  const interventionResult = await admin
    .from("disdagin_interventions")
    .select("id,referral_id,program_id,pendamping_id,consultant,start_date,stimulus,action_plan,participant_status,progress_percent,legal_status,evaluation_note")
    .in("referral_id", referralIds);
  fail(interventionResult.error, "Intervensi Disdagin tidak dapat dibaca");
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
    programIds.length ? admin.from("disdagin_program_details").select("program_id,pendamping_id,consultant").in("program_id", programIds) : Promise.resolve({ data: [], error: null }),
    interventionIds.length ? admin.from("disdagin_intervention_events").select("id,intervention_id,event_type,event_at,note,progress_percent").in("intervention_id", interventionIds).order("event_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
    interventionIds.length ? admin.from("disdagin_kemandirian_usaha").select("intervention_id,nib,omzet_bulanan,evaluasi_akhir").in("intervention_id", interventionIds) : Promise.resolve({ data: [], error: null }),
    admin.from("disdagin_business_profiles").select("warga_id,nama_usaha,kategori_usaha,nib").in("warga_id", wargaIds),
  ]);
  for (const [result, context] of [
    [wargaResult, "Warga referral Disdagin tidak dapat dibaca"],
    [desilResult, "Desil referral Disdagin tidak dapat dibaca"],
    [programsResult, "Program referral Disdagin tidak dapat dibaca"],
    [detailsResult, "Detail program referral Disdagin tidak dapat dibaca"],
    [eventsResult, "Timeline pendampingan Disdagin tidak dapat dibaca"],
    [outcomesResult, "Kemandirian usaha Disdagin tidak dapat dibaca"],
    [profilesResult, "Profil usaha referral Disdagin tidak dapat dibaca"],
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
  const eventMap = new Map<string, DisdaginTimelineEvent[]>();
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

  return referrals.flatMap((referral): DisdaginReferral[] => {
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
      consultant: intervention?.consultant ?? detail?.consultant ?? "Belum dipilih",
      desil: desilMap.get(referral.warga_id) ?? 0,
      kelurahan: warga.kelurahan ?? "—",
      status: mapStatus(referral.status),
      participantStatus: intervention?.participant_status ?? null,
      legalStatus: intervention?.legal_status ?? null,
      stimulus: intervention?.stimulus ?? "Belum ditentukan",
      actionPlan: intervention?.action_plan ?? referral.instruction ?? "",
      progress: intervention?.progress_percent ?? null,
      nib: outcome?.nib ?? profile?.nib ?? null,
      businessName: profile?.nama_usaha ?? referral.target_program ?? "Usaha belum didata",
      businessCategory: profile?.kategori_usaha ?? "Belum diklasifikasikan",
      monthlyRevenue: outcome ? Number(outcome.omzet_bulanan) : null,
      evaluation: outcome?.evaluasi_akhir ?? intervention?.evaluation_note ?? null,
      timeline: intervention ? eventMap.get(intervention.id) ?? [] : [],
    }];
  });
}

export async function getDisdaginDashboardData() {
  const referrals = await getDisdaginReferrals();
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

export async function getDisdaginRevenueReport() {
  if (previewEnabled) {
    return { businesses: [] as BusinessReport[], summary: { independent: 0, totalRevenue: 0, averageRevenue: 0 } };
  }
  const admin = createAdminClient();
  const outcomeResult = await admin
    .from("disdagin_kemandirian_usaha")
    .select("id,intervention_id,nib,nama_usaha,kategori_usaha,omzet_bulanan,stimulus_status");
  fail(outcomeResult.error, "Laporan omzet Disdagin tidak dapat dibaca");
  const outcomes = outcomeResult.data ?? [];
  if (!outcomes.length) {
    return { businesses: [] as BusinessReport[], summary: { independent: 0, totalRevenue: 0, averageRevenue: 0 } };
  }

  const interventionIds = outcomes.map((row) => row.intervention_id);
  const interventionResult = await admin
    .from("disdagin_interventions")
    .select("id,referral_id,program_id")
    .in("id", interventionIds);
  fail(interventionResult.error, "Intervensi laporan Disdagin tidak dapat dibaca");
  const interventions = interventionResult.data ?? [];
  const referralIds = interventions.map((row) => row.referral_id);
  const [referralResult, historyResult] = await Promise.all([
    admin.from("referral_mbi").select("id,referral_code,warga_id").in("id", referralIds),
    admin.from("disdagin_laporan_omzet").select("id,intervention_id,periode,nominal,status").in("intervention_id", interventionIds).order("periode", { ascending: false }),
  ]);
  fail(referralResult.error, "Referral laporan Disdagin tidak dapat dibaca");
  fail(historyResult.error, "Riwayat omzet Disdagin tidak dapat dibaca");
  const wargaIds = [...new Set((referralResult.data ?? []).map((row) => row.warga_id))];
  const [wargaResult, desilResult] = await Promise.all([
    admin.from("warga").select("id,nik,nama_lengkap,kelurahan").in("id", wargaIds),
    admin.from("penetapan_desil").select("warga_id,desil_dtsen,created_at").in("warga_id", wargaIds).order("created_at", { ascending: false }),
  ]);
  fail(wargaResult.error, "Warga laporan Disdagin tidak dapat dibaca");
  fail(desilResult.error, "Desil laporan Disdagin tidak dapat dibaca");

  const interventionMap = new Map(interventions.map((row) => [row.id, row]));
  const referralMap = new Map((referralResult.data ?? []).map((row) => [row.id, row]));
  const wargaMap = new Map((wargaResult.data ?? []).map((row) => [row.id, row]));
  const desilMap = new Map<string, number>();
  for (const row of desilResult.data ?? []) if (!desilMap.has(row.warga_id)) desilMap.set(row.warga_id, row.desil_dtsen ?? 0);
  const histories = new Map<string, RevenueHistory[]>();
  for (const row of historyResult.data ?? []) {
    const list = histories.get(row.intervention_id) ?? [];
    list.push({ id: row.id, period: formatPeriod(row.periode), amount: Number(row.nominal), status: row.status });
    histories.set(row.intervention_id, list);
  }

  const businesses = outcomes.flatMap((outcome): BusinessReport[] => {
    const intervention = interventionMap.get(outcome.intervention_id);
    const referral = intervention ? referralMap.get(intervention.referral_id) : null;
    const warga = referral ? wargaMap.get(referral.warga_id) : null;
    if (!intervention || !referral || !warga) return [];
    const history = histories.get(intervention.id) ?? [];
    const newest = history[0]?.amount ?? Number(outcome.omzet_bulanan);
    const oldest = history.at(-1)?.amount ?? newest;
    const growthPercent = oldest > 0 ? Math.round(((newest - oldest) / oldest) * 100) : 0;
    return [{
      id: outcome.id,
      referralCode: referral.referral_code,
      name: warga.nama_lengkap,
      maskedNik: maskNik(warga.nik),
      businessName: outcome.nama_usaha,
      nib: outcome.nib,
      category: outcome.kategori_usaha,
      monthlyRevenue: Number(outcome.omzet_bulanan),
      status: "MANDIRI",
      desil: desilMap.get(referral.warga_id) ?? 0,
      kelurahan: warga.kelurahan ?? "—",
      stimulus: outcome.stimulus_status ?? "Selesai",
      growthPercent,
      history,
    }];
  });
  const totalRevenue = businesses.reduce((sum, business) => sum + business.monthlyRevenue, 0);
  return {
    businesses,
    summary: {
      independent: businesses.length,
      totalRevenue,
      averageRevenue: businesses.length ? Math.round(totalRevenue / businesses.length) : 0,
    },
  };
}
