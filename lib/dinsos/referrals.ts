import "server-only";

import type { DinsosActor } from "@/lib/auth/require-dinsos-actor";
import { ApiError } from "@/lib/http/api-error-response";
import { maskNik } from "@/lib/privacy/mask-nik";
import { createAdminClient } from "@/lib/supabase/admin";

import { mapDinsosRpcError } from "./assessment";
import type { DinsosPath } from "./path-values";

export const DINSOS_REFERRALS_PAGE_SIZE = 3;
export const REFERRAL_STATUSES = ["MENUNGGU_RUJUKAN", "TERKIRIM", "DITERIMA", "DIPROSES", "SELESAI", "DIBATALKAN"] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];
export type ReferralFilters = { search?: string; path?: DinsosPath; status?: ReferralStatus; page?: number };

export type ReferralListItem = {
  referralId: string; referralCode: string; wargaId: string; maskedNik: string;
  nama: string; jalur: DinsosPath; targetOpdId: string; targetOpd: string;
  programId: string | null; program: string | null; status: ReferralStatus;
  createdAt: string; sentAt: string | null;
};

export type ReferralDetail = ReferralListItem & {
  caseId: string; assessmentId: string | null; pathDecisionId: string | null;
  desil: number | null; kelurahan: string; locationResolved: boolean;
  referralDate: string | null; instruction: string | null; receivedAt: string | null;
  processingStartedAt: string | null; completedAt: string | null;
};

export function referralAction(status: ReferralStatus) {
  if (status === "MENUNGGU_RUJUKAN") return "PROCESS" as const;
  if (["TERKIRIM", "DITERIMA", "DIPROSES", "SELESAI"].includes(status)) return "PROGRESS" as const;
  return "DETAIL" as const;
}

export async function getReferralSummary() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("dinsos_referral_summary");
  if (error) throw new Error("Gagal mengambil ringkasan referral.");
  const row = Array.isArray(data) ? data[0] : data;
  return {
    waitingReferral: Number(row?.waitingReferral ?? 0),
    inOpdProcess: Number(row?.inOpdProcess ?? 0),
    interventionCompleted: Number(row?.interventionCompleted ?? 0),
  };
}

export async function getReferrals(filters: ReferralFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("list_dinsos_referrals", {
    p_search: filters.search || null, p_path: filters.path || null,
    p_status: filters.status || null, p_limit: DINSOS_REFERRALS_PAGE_SIZE,
    p_offset: (page - 1) * DINSOS_REFERRALS_PAGE_SIZE,
  });
  if (error) throw new Error("Gagal mengambil daftar referral.");
  const rows = data ?? [];
  const referrals: ReferralListItem[] = rows.map((row: Record<string, unknown>) => ({
    referralId: String(row.referral_id), referralCode: String(row.referral_code),
    wargaId: String(row.warga_id), maskedNik: maskNik(String(row.nik ?? "")),
    nama: String(row.nama_lengkap), jalur: row.jalur as DinsosPath,
    targetOpdId: String(row.target_opd_id), targetOpd: String(row.target_opd_name ?? "OPD tidak tersedia"),
    programId: row.program_id ? String(row.program_id) : null,
    program: row.program_name ? String(row.program_name) : null,
    status: row.status as ReferralStatus, createdAt: String(row.created_at),
    sentAt: row.sent_at ? String(row.sent_at) : null,
  }));
  const total = Number(rows[0]?.total_count ?? 0);
  return { referrals, page, pageSize: DINSOS_REFERRALS_PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / DINSOS_REFERRALS_PAGE_SIZE)) };
}

export async function getReferralById(id: string): Promise<ReferralDetail | null> {
  const admin = createAdminClient();
  const { data: row, error } = await admin.from("referral_mbi")
    .select("id,referral_code,case_id,warga_id,assessment_id,path_decision_id,jalur,target_opd_id,program_id,status,created_at,sent_at,referral_date,instruction,received_at,processing_started_at,completed_at")
    .eq("id", id).eq("referral_type", "JALUR_MBI").maybeSingle();
  if (error) throw new Error("Gagal mengambil detail referral.");
  if (!row || !row.jalur || !row.target_opd_id) return null;
  const [wargaResult, opdResult, programResult, desilResult] = await Promise.all([
    admin.from("warga").select("id,nik,nama_lengkap,kelurahan,kecamatan,kelurahan_id,kecamatan_id").eq("id", row.warga_id).maybeSingle(),
    admin.from("master_opd").select("nama_opd").eq("id", row.target_opd_id).maybeSingle(),
    row.program_id ? admin.from("master_program_layanan").select("nama_program").eq("id", row.program_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    admin.from("penetapan_desil").select("desil_dtsen").eq("warga_id", row.warga_id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (wargaResult.error || opdResult.error || programResult.error || desilResult.error) throw new Error("Gagal mengambil detail referral.");
  const warga = wargaResult.data;
  if (!warga) return null;
  const locationResult = warga.kelurahan_id ? await admin.from("master_wilayah").select("nama").eq("id", warga.kelurahan_id).maybeSingle() : { data: null, error: null };
  if (locationResult.error) throw new Error("Gagal mengambil wilayah referral.");
  return {
    referralId: row.id, referralCode: row.referral_code, caseId: row.case_id,
    wargaId: row.warga_id, assessmentId: row.assessment_id, pathDecisionId: row.path_decision_id,
    maskedNik: maskNik(warga.nik), nama: warga.nama_lengkap, jalur: row.jalur as DinsosPath,
    targetOpdId: row.target_opd_id, targetOpd: opdResult.data?.nama_opd ?? "OPD tidak tersedia",
    programId: row.program_id, program: programResult.data?.nama_program ?? null,
    status: row.status as ReferralStatus, createdAt: row.created_at, sentAt: row.sent_at,
    desil: desilResult.data?.desil_dtsen ?? null,
    kelurahan: locationResult.data?.nama ?? warga.kelurahan ?? warga.kecamatan ?? "—",
    locationResolved: Boolean(warga.kelurahan_id && warga.kecamatan_id),
    referralDate: row.referral_date, instruction: row.instruction,
    receivedAt: row.received_at, processingStartedAt: row.processing_started_at,
    completedAt: row.completed_at,
  };
}

export async function getCompatiblePrograms(referral: ReferralDetail) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("master_program_layanan")
    .select("id,kode_program,nama_program,jalur").eq("opd_id", referral.targetOpdId)
    .eq("is_active", true).or(`jalur.eq.${referral.jalur},jalur.is.null`).order("nama_program");
  if (error) throw new Error("Gagal mengambil program intervensi.");
  return (data ?? []).map((program) => ({ id: program.id, code: program.kode_program, name: program.nama_program, path: program.jalur as DinsosPath | null }));
}

export async function sendStabilizationReferral(caseId: string, actor: DinsosActor) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("dinsos_send_stabilization", { p_case_id: caseId, p_actor_id: actor.profileId, p_source_opd_id: actor.opdId });
  if (error) throw mapDinsosRpcError(error);
  return data;
}

export function mapReferralRpcError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("REFERRAL_NOT_FOUND")) return new ApiError("Referral tidak ditemukan.", 404);
  if (message.includes("REFERRAL_ALREADY_SENT")) return new ApiError("Referral sudah pernah dikirim.", 409);
  if (message.includes("INVALID_REFERRAL_DATE")) return new ApiError("Tanggal pengiriman referral tidak valid.", 400);
  if (message.includes("PROGRAM_WRONG_OPD")) return new ApiError("Program tidak sesuai OPD tujuan.", 400);
  if (message.includes("PROGRAM_WRONG_PATH")) return new ApiError("Program tidak sesuai jalur referral.", 400);
  if (message.includes("INVALID_PROGRAM")) return new ApiError("Program intervensi tidak aktif atau tidak ditemukan.", 400);
  if (message.includes("INVALID_REFERRAL_TRANSITION")) return new ApiError("Transisi status referral tidak valid.", 409);
  if (message.includes("TARGET_OPD_REQUIRED")) return new ApiError("Akses OPD tujuan diperlukan.", 403);
  return new ApiError("Referral tidak dapat diproses.", 400);
}
