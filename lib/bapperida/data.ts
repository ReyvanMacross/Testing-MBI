import "server-only";

import { createDistribution } from "@/lib/diskominfo/desil-statistics";
import { createAdminClient } from "@/lib/supabase/admin";

export type InterventionPath = "PEKERJA" | "WIRAUSAHA" | "PENGUATAN_DASAR" | "AKSELERASI_SEKTORAL";
export type RecommendationStatus = "DRAFT" | "MENUNGGU_PERSETUJUAN" | "PERLU_REVISI" | "DITINDAKLANJUTI" | "SELESAI";

type OutcomeRow = {
  referral_id: string; warga_id: string; status: string; intervention_path: InterventionPath;
  desil_dtsen: number | null; created_at: string; completed_at: string | null;
};

type SnapshotRow = {
  id: string; period: string; intervention_path: InterventionPath | null; independent_citizens: number;
  program_success_rate: number; reentry_citizens: number; welfare_index: number;
  path_distribution: Record<string, number>; desil_distribution: Record<string, number>; status: string;
};

export type BapperidaDashboardData = {
  year: number;
  headline: { independentCitizens: number; successRate: number; reentryCitizens: number; welfareIndex: number };
  trend: Array<{ month: string; value: number }>;
  paths: Array<{ key: InterventionPath; label: string; percentage: number }>;
  desils: Array<{ label: string; percentage: number; color: string }>;
};

export type BapperidaRecommendation = {
  id: string; category: string; finding: string; recommendation: string; status: RecommendationStatus;
  mayorNote: string | null; version: number; updatedAt: string; recipients: Array<{ id: string; code: string; name: string }>;
};

export type EvaluationReport = {
  id: string; period: string; independentCitizens: number; successRate: number; reentryCitizens: number;
  welfareIndex: number; status: string; path: InterventionPath | null;
};

const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const pathDefinitions: Array<{ key: InterventionPath; label: string }> = [
  { key: "PEKERJA", label: "Jalur Pekerja" },
  { key: "WIRAUSAHA", label: "Jalur Wirausaha" },
  { key: "PENGUATAN_DASAR", label: "Penguatan Dasar" },
  { key: "AKSELERASI_SEKTORAL", label: "Akselerasi Sektoral" },
];

function rounded(value: number) { return Math.round(value * 10) / 10; }

export async function getBapperidaDashboard(year: number): Promise<BapperidaDashboardData> {
  const admin = createAdminClient();
  const from = `${year}-01-01T00:00:00.000Z`;
  const to = `${year + 1}-01-01T00:00:00.000Z`;
  const [outcomesResult, snapshotsResult] = await Promise.all([
    admin.from("bapperida_v_cross_opd_outcomes").select("referral_id,warga_id,status,intervention_path,desil_dtsen,created_at,completed_at").gte("created_at", from).lt("created_at", to),
    admin.from("bapperida_evaluation_snapshots").select("id,period,intervention_path,independent_citizens,program_success_rate,reentry_citizens,welfare_index,path_distribution,desil_distribution,status").gte("period", `${year}-01-01`).lt("period", `${year + 1}-01-01`).eq("status", "PUBLISHED").order("period", { ascending: true }),
  ]);
  if (outcomesResult.error) throw new Error("Gagal membaca outcome lintas OPD.", { cause: outcomesResult.error });
  if (snapshotsResult.error) throw new Error("Gagal membaca snapshot evaluasi Bapperida.", { cause: snapshotsResult.error });

  const outcomes = (outcomesResult.data ?? []) as OutcomeRow[];
  const snapshots = ((snapshotsResult.data ?? []) as SnapshotRow[]).filter((row) => row.intervention_path === null);
  const latest = snapshots.at(-1);
  const completed = outcomes.filter((row) => row.status === "SELESAI");
  const eligible = outcomes.filter((row) => row.status !== "DIBATALKAN");
  const referralCount = new Map<string, number>();
  for (const row of outcomes) referralCount.set(row.warga_id, (referralCount.get(row.warga_id) ?? 0) + 1);
  const independentCitizens = new Set(completed.map((row) => row.warga_id)).size;
  const reentryCitizens = [...referralCount.values()].filter((count) => count > 1).length;
  const successRate = eligible.length ? rounded((completed.length / eligible.length) * 100) : 0;
  const distribution = createDistribution(outcomes.map((row) => row.desil_dtsen));
  const welfareIndex = distribution.reduce((score, bucket) => score + bucket.percentage * (bucket.desil * 20), 0) / 100;
  const pathCounts = new Map<InterventionPath, number>(pathDefinitions.map(({ key }) => [key, 0]));
  for (const row of completed) pathCounts.set(row.intervention_path, (pathCounts.get(row.intervention_path) ?? 0) + 1);
  const completedTotal = completed.length || 1;
  const latestPaths = latest?.path_distribution ?? {};

  return {
    year,
    headline: latest ? {
      independentCitizens: latest.independent_citizens,
      successRate: Number(latest.program_success_rate),
      reentryCitizens: latest.reentry_citizens,
      welfareIndex: Number(latest.welfare_index),
    } : { independentCitizens, successRate, reentryCitizens, welfareIndex: rounded(welfareIndex) },
    trend: monthNames.map((month, index) => {
      const snapshot = snapshots.find((row) => new Date(`${row.period}T00:00:00Z`).getUTCMonth() === index);
      const live = new Set(completed.filter((row) => row.completed_at && new Date(row.completed_at).getUTCMonth() <= index).map((row) => row.warga_id)).size;
      return { month, value: snapshot?.independent_citizens ?? live };
    }),
    paths: pathDefinitions.map(({ key, label }) => ({
      key, label, percentage: Number(latestPaths[key] ?? rounded(((pathCounts.get(key) ?? 0) / completedTotal) * 100)),
    })),
    desils: distribution.map((bucket) => ({
      label: bucket.label === "Desil 1" ? "Desil 1 (Sangat Miskin)" : bucket.label === "Desil 2" ? "Desil 2 (Miskin)" : bucket.label === "Desil 3" ? "Desil 3 (Rentan)" : bucket.label,
      percentage: Number(latest?.desil_distribution?.[`D${bucket.desil}`] ?? bucket.percentage),
      color: ["#991b1b", "#ef4444", "#f97316", "#eab308", "#10b981"][bucket.desil - 1],
    })),
  };
}

export async function getBapperidaRecommendations(status?: string): Promise<{ items: BapperidaRecommendation[]; opdOptions: Array<{ id: string; code: string; name: string }> }> {
  const admin = createAdminClient();
  let query = admin.from("bapperida_recommendations").select("id,category,finding,recommendation,status,mayor_note,version,updated_at").order("updated_at", { ascending: false });
  if (status && status !== "SEMUA") query = query.eq("status", status);
  const [recommendationsResult, recipientsResult, opdResult] = await Promise.all([
    query,
    admin.from("bapperida_recommendation_recipients").select("recommendation_id,opd_id"),
    admin.from("master_opd").select("id,kode_opd,nama_opd").neq("kode_opd", "BAPPERIDA").order("nama_opd"),
  ]);
  if (recommendationsResult.error || recipientsResult.error || opdResult.error) throw new Error("Gagal membaca rekomendasi Bapperida.");
  const options = (opdResult.data ?? []).map((row) => ({ id: row.id, code: row.kode_opd ?? "OPD", name: row.nama_opd }));
  const optionMap = new Map(options.map((item) => [item.id, item]));
  const recipientRows = recipientsResult.data ?? [];
  return {
    items: (recommendationsResult.data ?? []).map((row) => ({
      id: row.id, category: row.category, finding: row.finding, recommendation: row.recommendation,
      status: row.status as RecommendationStatus, mayorNote: row.mayor_note, version: row.version, updatedAt: row.updated_at,
      recipients: recipientRows.filter((recipient) => recipient.recommendation_id === row.id).map((recipient) => optionMap.get(recipient.opd_id)).filter((item): item is { id: string; code: string; name: string } => Boolean(item)),
    })),
    opdOptions: options,
  };
}

export async function getBapperidaReports(year?: number, path?: string): Promise<EvaluationReport[]> {
  const admin = createAdminClient();
  let query = admin.from("bapperida_evaluation_snapshots").select("id,period,intervention_path,independent_citizens,program_success_rate,reentry_citizens,welfare_index,status").eq("status", "PUBLISHED").order("period", { ascending: false });
  if (year) query = query.gte("period", `${year}-01-01`).lt("period", `${year + 1}-01-01`);
  if (path && path !== "SEMUA") query = query.eq("intervention_path", path); else query = query.is("intervention_path", null);
  const { data, error } = await query;
  if (error) throw new Error("Gagal membaca laporan evaluasi Bapperida.", { cause: error });
  return (data ?? []).map((row) => ({ id: row.id, period: row.period, independentCitizens: row.independent_citizens, successRate: Number(row.program_success_rate), reentryCitizens: row.reentry_citizens, welfareIndex: Number(row.welfare_index), status: row.status, path: row.intervention_path as InterventionPath | null }));
}
