import "server-only";

import { maskFamilyCard } from "@/lib/privacy/mask-family-card";
import { maskNik } from "@/lib/privacy/mask-nik";
import { maskPhone } from "@/lib/privacy/mask-phone";
import { createAdminClient } from "@/lib/supabase/admin";

export const DINSOS_WARGA_PAGE_SIZE = 7;
export const VERIFIED_DATABASE_STATUS = "VERIFIED";

export type WargaRegistryFilters = {
  search?: string;
  kelurahanId?: string;
  desil?: number;
  verificationStatus?: "TERVERIFIKASI" | "BELUM";
  page?: number;
  intent?: "assessment-new";
};

export type WargaRegistryItem = {
  wargaId: string;
  maskedNik: string;
  namaLengkap: string;
  kelurahan: string | null;
  kecamatan: string | null;
  locationResolved: boolean;
  desil: number | null;
  verificationStatus: string | null;
  activePath: string | null;
};

export type WargaRegistryResult = {
  warga: WargaRegistryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type WargaProfile = {
  wargaId: string;
  maskedNik: string;
  maskedFamilyCard: string;
  maskedPhone: string;
  namaLengkap: string;
  kelurahan: string | null;
  kecamatan: string | null;
  kelurahanId: string | null;
  locationResolved: boolean;
  desil: number | null;
  verificationStatus: string | null;
  statusPerkawinan: string | null;
  alamatLengkap: string | null;
  pekerjaan: string | null;
  activePath: string | null;
  updatedAt: string;
  assessments: Array<{
    id: string;
    code: string;
    typeLabel: string;
    status: string;
    date: string;
    recommendation: string | null;
  }>;
  referrals: Array<{
    id: string;
    targetOpd: string | null;
    program: string | null;
    type: string;
    status: string;
    sentAt: string;
  }>;
};

type RegistryRow = Record<string, unknown>;

function isMissingRpc(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
      (error.code === "PGRST202" ||
        error.message?.includes("Could not find the function")),
  );
}

function canUseDevelopmentRpcFallback() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.DINSOS_ALLOW_RPC_FALLBACK === "true"
  );
}

function toRegistryItem(row: RegistryRow): WargaRegistryItem {
  return {
    wargaId: String(row.warga_id),
    maskedNik: maskNik(typeof row.nik === "string" ? row.nik : null),
    namaLengkap: String(row.nama_lengkap),
    kelurahan: typeof row.kelurahan === "string" ? row.kelurahan : null,
    kecamatan: typeof row.kecamatan === "string" ? row.kecamatan : null,
    locationResolved: Boolean(row.location_resolved),
    desil: typeof row.desil === "number" ? row.desil : null,
    verificationStatus:
      typeof row.status_verifikasi === "string"
        ? row.status_verifikasi
        : null,
    activePath:
      typeof row.jalur_aktif === "string" && row.jalur_aktif.trim()
        ? row.jalur_aktif
        : null,
  };
}

function latestByWarga(rows: RegistryRow[]) {
  const result = new Map<string, RegistryRow>();
  for (const row of rows) {
    const wargaId = String(row.warga_id);
    if (!result.has(wargaId)) result.set(wargaId, row);
  }
  return result;
}

export async function getDinsosWargaSummary() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("dinsos_warga_summary");

  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    return {
      total: Number(row?.total_warga ?? 0),
      verified: Number(row?.sudah_diverifikasi ?? 0),
      unverified: Number(row?.belum_diverifikasi ?? 0),
    };
  }

  if (!isMissingRpc(error) || !canUseDevelopmentRpcFallback()) {
    throw new Error("Gagal mengambil ringkasan Data Warga.");
  }

  const [wargaResult, verificationResult] = await Promise.all([
    admin.from("warga").select("id", { count: "exact", head: true }),
    admin
      .from("verifikasi_validasi")
      .select("warga_id,status_verifikasi,created_at,id")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
  ]);
  if (wargaResult.error || verificationResult.error) {
    throw new Error("Gagal mengambil ringkasan Data Warga.");
  }
  const latest = latestByWarga(verificationResult.data ?? []);
  const verified = [...latest.values()].filter(
    (row) => row.status_verifikasi === VERIFIED_DATABASE_STATUS,
  ).length;
  const total = wargaResult.count ?? 0;
  return { total, verified, unverified: total - verified };
}

async function getDinsosWargaFallback(
  filters: WargaRegistryFilters,
): Promise<WargaRegistryResult> {
  const admin = createAdminClient();
  const [wargaResult, desilResult, verificationResult, pathResult, referralResult, interventionResult] =
    await Promise.all([
      admin
        .from("warga")
        .select(
          "id,nik,nama_lengkap,kelurahan,kecamatan,kelurahan_id,kecamatan_id",
        )
        .limit(5000),
      admin
        .from("penetapan_desil")
        .select("id,warga_id,desil_dtsen,created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }),
      admin
        .from("verifikasi_validasi")
        .select("id,warga_id,status_verifikasi,created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }),
      admin
        .from("penentuan_jalur")
        .select("id,warga_id,output_jalur,created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }),
      admin
        .from("referral_mbi")
        .select("id,warga_id,target_program,referral_type,status,sent_at")
        .in("status", ["TERKIRIM", "DITERIMA", "DIPROSES"])
        .order("sent_at", { ascending: false })
        .order("id", { ascending: false }),
      admin
        .from("intervensi_lanjutan")
        .select("id,warga_id,nama_program,opd,status,created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }),
    ]);

  for (const result of [wargaResult, desilResult, verificationResult, pathResult, referralResult, interventionResult]) {
    if (result.error) throw new Error("Gagal mengambil daftar Data Warga.");
  }

  const desils = latestByWarga(desilResult.data ?? []);
  const verifications = latestByWarga(verificationResult.data ?? []);
  const paths = latestByWarga(pathResult.data ?? []);
  const referrals = latestByWarga(referralResult.data ?? []);
  const interventions = latestByWarga(
    (interventionResult.data ?? []).filter((row) => {
      const status = row.status?.toString().trim().toUpperCase();
      return !status || !["SELESAI", "DIBATALKAN"].includes(status);
    }),
  );
  const search = filters.search?.toLocaleLowerCase("id-ID") ?? "";
  const rows = (wargaResult.data ?? [])
    .map((warga) => {
      const desil = desils.get(warga.id);
      const verification = verifications.get(warga.id);
      const referral = referrals.get(warga.id);
      const intervention = interventions.get(warga.id);
      const path = paths.get(warga.id);
      return {
        warga_id: warga.id,
        nik: warga.nik,
        nama_lengkap: warga.nama_lengkap,
        kelurahan: warga.kelurahan,
        kecamatan: warga.kecamatan,
        kelurahan_id: warga.kelurahan_id,
        location_resolved: Boolean(warga.kelurahan_id && warga.kecamatan_id),
        desil: desil?.desil_dtsen ?? null,
        status_verifikasi: verification?.status_verifikasi ?? null,
        jalur_aktif:
          referral?.target_program ??
          referral?.referral_type?.toString().replaceAll("_", " ") ??
          intervention?.nama_program ??
          intervention?.opd ??
          path?.output_jalur?.toString().replaceAll("_", " ") ??
          null,
      };
    })
    .filter((row) => {
      if (
        search &&
        !row.nama_lengkap.toLocaleLowerCase("id-ID").includes(search) &&
        !row.nik?.includes(search)
      ) return false;
      if (filters.kelurahanId && row.kelurahan_id !== filters.kelurahanId) return false;
      if (filters.desil && row.desil !== filters.desil) return false;
      if (
        filters.verificationStatus === "TERVERIFIKASI" &&
        row.status_verifikasi !== VERIFIED_DATABASE_STATUS
      ) return false;
      if (
        filters.verificationStatus === "BELUM" &&
        row.status_verifikasi === VERIFIED_DATABASE_STATUS
      ) return false;
      return true;
    })
    .sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap, "id"));

  const page = Math.max(1, filters.page ?? 1);
  const total = rows.length;
  const start = (page - 1) * DINSOS_WARGA_PAGE_SIZE;
  return {
    warga: rows.slice(start, start + DINSOS_WARGA_PAGE_SIZE).map(toRegistryItem),
    page,
    pageSize: DINSOS_WARGA_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / DINSOS_WARGA_PAGE_SIZE)),
  };
}

export async function getDinsosWarga(
  filters: WargaRegistryFilters = {},
): Promise<WargaRegistryResult> {
  const page = Math.max(1, filters.page ?? 1);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("list_dinsos_warga", {
    p_search: filters.search || null,
    p_kelurahan_id: filters.kelurahanId || null,
    p_desil: filters.desil ?? null,
    p_verification_status: filters.verificationStatus ?? null,
    p_limit: DINSOS_WARGA_PAGE_SIZE,
    p_offset: (page - 1) * DINSOS_WARGA_PAGE_SIZE,
  });

  if (error) {
    if (isMissingRpc(error) && canUseDevelopmentRpcFallback()) {
      return getDinsosWargaFallback(filters);
    }
    throw new Error("Gagal mengambil daftar Data Warga.");
  }

  const rows = data ?? [];
  const total = Number(rows[0]?.total_count ?? 0);
  return {
    warga: rows.map(toRegistryItem),
    page,
    pageSize: DINSOS_WARGA_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / DINSOS_WARGA_PAGE_SIZE)),
  };
}

export async function getDinsosWargaOptions() {
  const admin = createAdminClient();
  const [kelurahanResult, kecamatanResult, statusResult, unresolvedResult] =
    await Promise.all([
      admin
        .from("master_wilayah")
        .select("id,nama,parent_id")
        .eq("jenis", "KELURAHAN")
        .eq("is_active", true)
        .order("nama"),
      admin
        .from("master_wilayah")
        .select("id,nama")
        .eq("jenis", "KECAMATAN")
        .eq("is_active", true),
      admin.from("warga").select("status_perkawinan").limit(5000),
      admin
        .from("warga")
        .select("id", { count: "exact", head: true })
        .is("kelurahan_id", null),
    ]);
  if (
    kelurahanResult.error ||
    kecamatanResult.error ||
    statusResult.error ||
    unresolvedResult.error
  ) throw new Error("Gagal mengambil pilihan Data Warga.");
  const parents = new Map(
    (kecamatanResult.data ?? []).map((row) => [row.id, row.nama]),
  );
  const kelurahan = (kelurahanResult.data ?? []).map((row) => ({
    id: row.id,
    nama: row.nama,
    kecamatan: parents.get(row.parent_id) ?? "Kecamatan tidak diketahui",
  }));
  const maritalStatuses = Array.from(
    new Set(
      (statusResult.data ?? [])
        .map((row) => row.status_perkawinan?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b, "id"));
  return {
    kelurahan,
    maritalStatuses,
    unresolvedWarga: unresolvedResult.count ?? 0,
  };
}

async function resolveActivePath(wargaId: string) {
  const admin = createAdminClient();
  const [referral, intervention, path] = await Promise.all([
    admin
      .from("referral_mbi")
      .select("target_program,referral_type,status,sent_at")
      .eq("warga_id", wargaId)
      .in("status", ["TERKIRIM", "DITERIMA", "DIPROSES"])
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("intervensi_lanjutan")
      .select("nama_program,opd,status,created_at")
      .eq("warga_id", wargaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("penentuan_jalur")
      .select("output_jalur,created_at")
      .eq("warga_id", wargaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const activeIntervention = intervention.data &&
    !["SELESAI", "DIBATALKAN"].includes(
      intervention.data.status?.trim().toUpperCase() ?? "",
    )
    ? intervention.data
    : null;
  return (
    referral.data?.target_program ??
    referral.data?.referral_type?.replaceAll("_", " ") ??
    activeIntervention?.nama_program ??
    activeIntervention?.opd ??
    path.data?.output_jalur?.replaceAll("_", " ") ??
    null
  );
}

export async function getDinsosWargaProfile(
  wargaId: string,
): Promise<WargaProfile | null> {
  const admin = createAdminClient();
  const { data: warga, error } = await admin
    .from("warga")
    .select(
      "id,nik,nomor_kk,nomor_hp,nama_lengkap,kelurahan,kecamatan,kelurahan_id,kecamatan_id,status_perkawinan,alamat_lengkap,pekerjaan,updated_at",
    )
    .eq("id", wargaId)
    .maybeSingle();
  if (error || !warga) return null;

  const [kelurahanResult, kecamatanResult, desilResult, verificationResult, assessmentsResult, referralsResult, assessmentTypesResult, activePath] =
    await Promise.all([
      warga.kelurahan_id
        ? admin
            .from("master_wilayah")
            .select("nama")
            .eq("id", warga.kelurahan_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      warga.kecamatan_id
        ? admin
            .from("master_wilayah")
            .select("nama")
            .eq("id", warga.kecamatan_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("penetapan_desil")
        .select("desil_dtsen")
        .eq("warga_id", wargaId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("verifikasi_validasi")
        .select("status_verifikasi")
        .eq("warga_id", wargaId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("dinsos_assessments")
        .select("id,assessment_code,status,assessment_date,assessment_type_code,field_recommendation")
        .eq("warga_id", wargaId)
        .order("assessment_date", { ascending: false })
        .limit(20),
      admin
        .from("referral_mbi")
        .select("id,referral_type,target_opd_id,target_program,status,sent_at")
        .eq("warga_id", wargaId)
        .order("sent_at", { ascending: false })
        .limit(20),
      admin
        .from("dinsos_assessment_types")
        .select("code,list_label"),
      resolveActivePath(wargaId),
    ]);
  if (assessmentsResult.error || referralsResult.error || assessmentTypesResult.error) {
    throw new Error("Gagal mengambil profil Data Warga.");
  }

  const opdIds = Array.from(
    new Set(
      (referralsResult.data ?? [])
        .map((row) => row.target_opd_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const opdResult = opdIds.length
    ? await admin.from("master_opd").select("id,nama_opd").in("id", opdIds)
    : { data: [], error: null };
  if (opdResult.error) throw new Error("Gagal mengambil OPD referral.");
  const opdMap = new Map(
    (opdResult.data ?? []).map((row) => [row.id, row.nama_opd]),
  );
  const assessmentTypeMap = new Map(
    (assessmentTypesResult.data ?? []).map((row) => [row.code, row.list_label]),
  );

  return {
    wargaId: warga.id,
    maskedNik: maskNik(warga.nik),
    maskedFamilyCard: maskFamilyCard(warga.nomor_kk),
    maskedPhone: maskPhone(warga.nomor_hp),
    namaLengkap: warga.nama_lengkap,
    kelurahan: kelurahanResult.data?.nama ?? warga.kelurahan,
    kecamatan: kecamatanResult.data?.nama ?? warga.kecamatan,
    kelurahanId: warga.kelurahan_id,
    locationResolved: Boolean(warga.kelurahan_id && warga.kecamatan_id),
    desil: desilResult.data?.desil_dtsen ?? null,
    verificationStatus: verificationResult.data?.status_verifikasi ?? null,
    statusPerkawinan: warga.status_perkawinan,
    alamatLengkap: warga.alamat_lengkap,
    pekerjaan: warga.pekerjaan,
    activePath,
    updatedAt: warga.updated_at,
    assessments: (assessmentsResult.data ?? []).map((row) => ({
      id: row.id,
      code: row.assessment_code,
      typeLabel: assessmentTypeMap.get(row.assessment_type_code) ?? row.assessment_type_code,
      status: row.status,
      date: row.assessment_date,
      recommendation: row.field_recommendation,
    })),
    referrals: (referralsResult.data ?? []).map((row) => ({
      id: row.id,
      targetOpd: row.target_opd_id ? opdMap.get(row.target_opd_id) ?? null : null,
      program: row.target_program,
      type: row.referral_type,
      status: row.status,
      sentAt: row.sent_at,
    })),
  };
}
