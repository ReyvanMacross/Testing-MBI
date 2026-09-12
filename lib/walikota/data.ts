import "server-only";

import { getBapperidaDashboard, type BapperidaDashboardData } from "@/lib/bapperida/data";
import { createAdminClient } from "@/lib/supabase/admin";

export type ExecutiveOpdOutcome = {
  code: string;
  name: string;
  total: number;
  completed: number;
  active: number;
  completionRate: number;
};

export type WalikotaDashboardData = BapperidaDashboardData & {
  activeOpds: number;
  pendingRecommendations: number;
  completedOutcomes: number;
  opdOutcomes: ExecutiveOpdOutcome[];
  priorityRegions: Array<{ name: string; vulnerable: number; active: number }>;
};

export type WalikotaDisposition = {
  id: string;
  opdId: string;
  opdCode: string;
  opdName: string;
  instruction: string;
  dueDate: string | null;
  status: string;
};

export type WalikotaDecision = {
  id: string;
  recommendationId: string;
  referenceCode: string;
  category: string;
  finding: string;
  recommendation: string;
  action: "APPROVE" | "REQUEST_REVISION";
  priorityLevel: "NORMAL" | "TINGGI" | "MENDESAK";
  leaderNote: string;
  resultingStatus: string;
  decidedAt: string;
  dispositions: WalikotaDisposition[];
};

export type ExecutiveRecommendation = {
  id: string;
  referenceCode: string;
  category: string;
  finding: string;
  recommendation: string;
  status: string;
  mayorNote: string | null;
  version: number;
  submittedAt: string | null;
  updatedAt: string;
  recipients: Array<{ id: string; code: string; name: string }>;
  latestDecision: WalikotaDecision | null;
};

type OutcomeRow = {
  warga_id: string;
  kode_opd: string | null;
  status: string;
  kecamatan: string | null;
  desil_dtsen: number | null;
};

function rounded(value: number) { return Math.round(value * 10) / 10; }

export async function getWalikotaDashboard(year: number): Promise<WalikotaDashboardData> {
  const admin = createAdminClient();
  const base = await getBapperidaDashboard(year);
  const from = `${year}-01-01T00:00:00.000Z`;
  const to = `${year + 1}-01-01T00:00:00.000Z`;
  const [outcomesResult, opdsResult, pendingResult] = await Promise.all([
    admin.from("walikota_v_executive_outcomes").select("warga_id,kode_opd,status,kecamatan,desil_dtsen").gte("created_at", from).lt("created_at", to),
    admin.from("master_opd").select("kode_opd,nama_opd"),
    admin.from("bapperida_recommendations").select("id", { count: "exact", head: true }).eq("status", "MENUNGGU_PERSETUJUAN"),
  ]);
  if (outcomesResult.error || opdsResult.error || pendingResult.error) throw new Error("Dashboard eksekutif tidak dapat dimuat.");
  const outcomes = (outcomesResult.data ?? []) as OutcomeRow[];
  const opdNames = new Map((opdsResult.data ?? []).map((opd) => [opd.kode_opd, opd.nama_opd]));
  const byOpd = new Map<string, OutcomeRow[]>();
  for (const row of outcomes) if (row.kode_opd) byOpd.set(row.kode_opd, [...(byOpd.get(row.kode_opd) ?? []), row]);
  const opdOutcomes = [...byOpd.entries()].map(([code, rows]) => {
    const completed = rows.filter((row) => row.status === "SELESAI").length;
    const active = rows.filter((row) => !["SELESAI", "DIBATALKAN"].includes(row.status)).length;
    return { code, name: opdNames.get(code) ?? code, total: rows.length, completed, active, completionRate: rows.length ? rounded((completed / rows.length) * 100) : 0 };
  }).sort((a, b) => b.completionRate - a.completionRate || b.total - a.total);
  const regionMap = new Map<string, { vulnerable: Set<string>; active: number }>();
  for (const row of outcomes) {
    const name = row.kecamatan ?? "Belum dipetakan";
    const value = regionMap.get(name) ?? { vulnerable: new Set<string>(), active: 0 };
    if (row.desil_dtsen != null && row.desil_dtsen <= 2) value.vulnerable.add(row.warga_id);
    if (!["SELESAI", "DIBATALKAN"].includes(row.status)) value.active += 1;
    regionMap.set(name, value);
  }
  return {
    ...base,
    activeOpds: byOpd.size,
    pendingRecommendations: pendingResult.count ?? 0,
    completedOutcomes: outcomes.filter((row) => row.status === "SELESAI").length,
    opdOutcomes,
    priorityRegions: [...regionMap.entries()].map(([name, value]) => ({ name, vulnerable: value.vulnerable.size, active: value.active })).sort((a, b) => b.vulnerable - a.vulnerable || b.active - a.active).slice(0, 5),
  };
}

export async function getExecutiveRecommendations(status?: string): Promise<{ items: ExecutiveRecommendation[]; opdOptions: Array<{ id: string; code: string; name: string }> }> {
  const admin = createAdminClient();
  let recommendationQuery = admin.from("bapperida_recommendations").select("id,reference_code,category,finding,recommendation,status,mayor_note,version,submitted_at,updated_at").neq("status", "DRAFT").order("updated_at", { ascending: false });
  if (status && status !== "SEMUA") recommendationQuery = recommendationQuery.eq("status", status);
  const [recommendationsResult, recipientsResult, decisionsResult, dispositionsResult, opdsResult] = await Promise.all([
    recommendationQuery,
    admin.from("bapperida_recommendation_recipients").select("recommendation_id,opd_id"),
    admin.from("walikota_decisions").select("id,recommendation_id,action,priority_level,leader_note,resulting_status,decided_at").order("decided_at", { ascending: false }),
    admin.from("walikota_dispositions").select("id,decision_id,target_opd_id,instruction,due_date,status"),
    admin.from("master_opd").select("id,kode_opd,nama_opd").not("kode_opd", "in", "(BAPPERIDA,WALIKOTA)").order("nama_opd"),
  ]);
  for (const result of [recommendationsResult, recipientsResult, decisionsResult, dispositionsResult, opdsResult]) if (result.error) throw new Error("Rekomendasi eksekutif tidak dapat dimuat.", { cause: result.error });
  const options = (opdsResult.data ?? []).map((opd) => ({ id: opd.id, code: opd.kode_opd ?? "OPD", name: opd.nama_opd }));
  const opdMap = new Map(options.map((opd) => [opd.id, opd]));
  const dispositions = dispositionsResult.data ?? [];
  const decisions = (decisionsResult.data ?? []).map((decision) => ({
    id: decision.id,
    recommendationId: decision.recommendation_id,
    referenceCode: "",
    category: "",
    finding: "",
    recommendation: "",
    action: decision.action as WalikotaDecision["action"],
    priorityLevel: decision.priority_level as WalikotaDecision["priorityLevel"],
    leaderNote: decision.leader_note,
    resultingStatus: decision.resulting_status,
    decidedAt: decision.decided_at,
    dispositions: dispositions.filter((item) => item.decision_id === decision.id).map((item) => {
      const opd = opdMap.get(item.target_opd_id);
      return { id: item.id, opdId: item.target_opd_id, opdCode: opd?.code ?? "OPD", opdName: opd?.name ?? "Perangkat Daerah", instruction: item.instruction, dueDate: item.due_date, status: item.status };
    }),
  }));
  const recipients = recipientsResult.data ?? [];
  const items = (recommendationsResult.data ?? []).map((row) => {
    const latestDecision = decisions.find((decision) => decision.recommendationId === row.id) ?? null;
    if (latestDecision) Object.assign(latestDecision, { referenceCode: row.reference_code, category: row.category, finding: row.finding, recommendation: row.recommendation });
    return {
      id: row.id, referenceCode: row.reference_code, category: row.category, finding: row.finding,
      recommendation: row.recommendation, status: row.status, mayorNote: row.mayor_note,
      version: row.version, submittedAt: row.submitted_at, updatedAt: row.updated_at,
      recipients: recipients.filter((recipient) => recipient.recommendation_id === row.id).map((recipient) => opdMap.get(recipient.opd_id)).filter((opd): opd is { id: string; code: string; name: string } => Boolean(opd)),
      latestDecision,
    };
  });
  return { items, opdOptions: options };
}

export async function getWalikotaDecisions(): Promise<WalikotaDecision[]> {
  const { items } = await getExecutiveRecommendations();
  return items.map((item) => item.latestDecision).filter((decision): decision is WalikotaDecision => Boolean(decision)).sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));
}
