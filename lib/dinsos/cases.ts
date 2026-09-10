import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { maskNik } from "@/lib/privacy/mask-nik";
import { maskPhone } from "@/lib/privacy/mask-phone";

export const DINSOS_CASE_PAGE_SIZE = 6;

export type DinsosCaseFilters = {
  search?: string;
  kelurahan?: string;
  stage?: string;
  sort?: "priority" | "oldest" | "newest";
  page?: number;
};

export type DinsosQueueItem = {
  caseId: string;
  wargaId: string;
  maskedNik: string;
  nama: string;
  kelurahan: string | null;
  kecamatan: string | null;
  locationResolved: boolean;
  currentStage: string;
  priority: string;
  queueEnteredAt: string;
  jenisKelamin: string | null;
  hasPhoto: boolean;
};

export type DinsosCaseDetail = {
  id: string;
  wargaId: string;
  currentStage: string;
  priority: string;
  queueEnteredAt: string;
  locationResolved: boolean;
  warga: {
    nama: string;
    maskedNik: string;
    tempatLahir: string | null;
    tanggalLahir: string | null;
    jenisKelamin: string | null;
    statusPerkawinan: string | null;
    maskedPhone: string;
    alamat: string | null;
    kelurahan: string | null;
    kecamatan: string | null;
    pendidikan: string | null;
    pekerjaan: string | null;
    jumlahAnggotaKk: number | null;
    statusRumah: string | null;
  };
  verification: null | {
    status: string;
    petugas: string | null;
    tanggal: string | null;
    documents: { ktp: boolean; kk: boolean; rumah: boolean; kondisiRumah: boolean };
  };
  officialDesil: null | { desil: number; pbi: boolean | null; pkh: boolean | null; bpnt: boolean | null };
  assessment: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  referral: Record<string, unknown> | null;
  canOverride: boolean;
};

export async function getQueueSummary() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("dinsos_queue_summary");
  if (error) throw new Error("Gagal mengambil ringkasan antrian Dinsos.");
  return {
    waitingAssessment: Number(data?.waitingAssessment ?? 0),
    waitingDesil: Number(data?.waitingDesil ?? 0),
    waitingStabilization: Number(data?.waitingStabilization ?? 0),
    waitingSplit: Number(data?.waitingSplit ?? 0),
    referralsThisMonth: Number(data?.referralsThisMonth ?? 0),
  };
}

export async function getDinsosCases(filters: DinsosCaseFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("list_dinsos_cases", {
    p_search: filters.search || null,
    p_kelurahan: filters.kelurahan || null,
    p_stage: filters.stage || null,
    p_sort: filters.sort ?? "priority",
    p_limit: DINSOS_CASE_PAGE_SIZE,
    p_offset: (page - 1) * DINSOS_CASE_PAGE_SIZE,
  });
  if (error) throw new Error("Gagal mengambil antrian kasus Dinsos.");
  const rows = data ?? [];
  const total = Number(rows[0]?.total_count ?? 0);
  const wargaIds = Array.from(new Set(rows.map((row: Record<string, unknown>) => String(row.warga_id))));
  const jenisKelamin = new Map<string, string | null>();
  const fotoTerbaru = new Map<string, boolean>();
  if (wargaIds.length) {
    const [wargaResult, fotoResult] = await Promise.all([
      admin.from("warga").select("id,jenis_kelamin").in("id", wargaIds),
      admin
        .from("verifikasi_validasi")
        .select("id,warga_id,foto_ktp_url,created_at")
        .in("warga_id", wargaIds)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }),
    ]);
    if (wargaResult.error || fotoResult.error) {
      throw new Error("Gagal mengambil foto antrian Dinsos.");
    }
    for (const warga of wargaResult.data ?? []) {
      jenisKelamin.set(warga.id, warga.jenis_kelamin);
    }
    for (const foto of fotoResult.data ?? []) {
      if (!fotoTerbaru.has(foto.warga_id)) {
        fotoTerbaru.set(foto.warga_id, Boolean(foto.foto_ktp_url));
      }
    }
  }
  return {
    cases: rows.map((row: Record<string, unknown>) => ({
      caseId: String(row.case_id), wargaId: String(row.warga_id),
      maskedNik: maskNik(typeof row.nik === "string" ? row.nik : null),
      nama: String(row.nama), kelurahan: row.kelurahan ? String(row.kelurahan) : null,
      kecamatan: row.kecamatan ? String(row.kecamatan) : null,
      locationResolved: Boolean(row.location_resolved), currentStage: String(row.current_stage),
      priority: String(row.priority), queueEnteredAt: String(row.queue_entered_at),
      jenisKelamin: jenisKelamin.get(String(row.warga_id)) ?? null,
      hasPhoto: fotoTerbaru.get(String(row.warga_id)) ?? false,
    })) as DinsosQueueItem[],
    page, pageSize: DINSOS_CASE_PAGE_SIZE, total,
    totalPages: Math.max(1, Math.ceil(total / DINSOS_CASE_PAGE_SIZE)),
  };
}

export async function getDinsosFilterOptions() {
  const admin = createAdminClient();
  const { data, error } = await admin.from("dinsos_cases")
    .select("warga(kelurahan)").is("closed_at", null).limit(1000);
  if (error) throw new Error("Gagal mengambil filter antrian.");
  const kelurahan = Array.from(new Set((data ?? []).map((row) => {
    const warga = Array.isArray(row.warga) ? row.warga[0] : row.warga;
    return warga?.kelurahan?.trim();
  }).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "id"));
  return { kelurahan };
}

export async function getDinsosCaseById(caseId: string, actorProfileId?: string): Promise<DinsosCaseDetail | null> {
  const admin = createAdminClient();
  const { data: caseRow, error } = await admin.from("dinsos_cases")
    .select("id,warga_id,current_stage,priority,queue_entered_at,warga(*)")
    .eq("id", caseId).maybeSingle();
  if (error || !caseRow) return null;
  const warga = Array.isArray(caseRow.warga) ? caseRow.warga[0] : caseRow.warga;
  if (!warga) return null;

  const [verificationResult, desilResult, assessmentResult, resultResult, referralResult, capabilityResult, kelurahanResult, kecamatanResult] = await Promise.all([
    admin.from("verifikasi_validasi").select("status_verifikasi,petugas_verifikasi,tanggal_verifikasi,foto_ktp_url,foto_kk_url,foto_rumah_url,foto_kondisi_rumah_url").eq("warga_id", caseRow.warga_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("penetapan_desil").select("desil_dtsen,status_pbi,status_pkh,status_sembako_bpnt").eq("warga_id", caseRow.warga_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("dinsos_asesmen_sosial").select("*").eq("case_id", caseId).maybeSingle(),
    admin.from("dinsos_case_results").select("*").eq("case_id", caseId).maybeSingle(),
    admin.from("referral_mbi").select("id,referral_type,status,sent_at,target_program").eq("case_id", caseId).order("sent_at", { ascending: false }).limit(1).maybeSingle(),
    actorProfileId ? admin.from("user_capabilities").select("capability").eq("user_id", actorProfileId).eq("capability", "DINSOS_DESIL_OVERRIDE").maybeSingle() : Promise.resolve({ data: null }),
    warga.kelurahan_id ? admin.from("master_wilayah").select("nama").eq("id", warga.kelurahan_id).maybeSingle() : Promise.resolve({ data: null }),
    warga.kecamatan_id ? admin.from("master_wilayah").select("nama").eq("id", warga.kecamatan_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const verification = verificationResult.data;
  const desil = desilResult.data;
  return {
    id: caseRow.id, wargaId: caseRow.warga_id, currentStage: caseRow.current_stage,
    priority: caseRow.priority, queueEnteredAt: caseRow.queue_entered_at,
    locationResolved: Boolean(warga.kecamatan_id && warga.kelurahan_id),
    warga: {
      nama: warga.nama_lengkap, maskedNik: maskNik(warga.nik), tempatLahir: warga.tempat_lahir,
      tanggalLahir: warga.tanggal_lahir, jenisKelamin: warga.jenis_kelamin,
      statusPerkawinan: warga.status_perkawinan, maskedPhone: maskPhone(warga.nomor_hp),
      alamat: warga.alamat_lengkap, kelurahan: kelurahanResult.data?.nama ?? warga.kelurahan,
      kecamatan: kecamatanResult.data?.nama ?? warga.kecamatan, pendidikan: warga.pendidikan_terakhir,
      pekerjaan: warga.pekerjaan, jumlahAnggotaKk: warga.jumlah_anggota_kk, statusRumah: warga.status_rumah,
    },
    verification: verification ? {
      status: verification.status_verifikasi, petugas: verification.petugas_verifikasi,
      tanggal: verification.tanggal_verifikasi,
      documents: { ktp: Boolean(verification.foto_ktp_url), kk: Boolean(verification.foto_kk_url), rumah: Boolean(verification.foto_rumah_url), kondisiRumah: Boolean(verification.foto_kondisi_rumah_url) },
    } : null,
    officialDesil: desil?.desil_dtsen ? { desil: desil.desil_dtsen, pbi: desil.status_pbi, pkh: desil.status_pkh, bpnt: desil.status_sembako_bpnt } : null,
    assessment: assessmentResult.data, result: resultResult.data, referral: referralResult.data,
    canOverride: Boolean(capabilityResult.data),
  };
}

export async function getCaseDocumentReference(caseId: string, type: "ktp" | "kk" | "rumah" | "kondisi-rumah") {
  const admin = createAdminClient();
  const { data: row } = await admin.from("dinsos_cases").select("warga_id").eq("id", caseId).maybeSingle();
  if (!row) return null;
  const columns = { ktp: "foto_ktp_url", kk: "foto_kk_url", rumah: "foto_rumah_url", "kondisi-rumah": "foto_kondisi_rumah_url" } as const;
  const column = columns[type];
  const { data } = await admin.from("verifikasi_validasi").select(column).eq("warga_id", row.warga_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as Record<string, string | null> | null)?.[column] ?? null;
}
