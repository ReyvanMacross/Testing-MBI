import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const USERS_PAGE_SIZE = 15;

export type ManagedUser = {
  id: string;
  authUserId: string | null;
  email: string;
  nip: string | null;
  username: string | null;
  namaLengkap: string;
  role: string;
  opdId: string | null;
  opdNama: string | null;
  wilayahId: string | null;
  wilayahNama: string | null;
  wilayahJenis: "KECAMATAN" | "KELURAHAN" | null;
  wilayahLegacy: string | null;
  status: "AKTIF" | "NONAKTIF";
  instansi: string | null;
  createdAt: string;
};

export type OpdOption = {
  id: string;
  kode: string;
  nama: string;
};

export type WilayahOption = {
  id: string;
  kode: string;
  nama: string;
  jenis: "KECAMATAN" | "KELURAHAN";
  parentNama: string | null;
};

export type UserFilters = {
  search?: string;
  opdId?: string;
  wilayahId?: string;
  page?: number;
};

type ManagedUserRpcRow = {
  id: string;
  auth_user_id: string | null;
  email: string;
  nip: string | null;
  username: string | null;
  nama_lengkap: string;
  role: string;
  opd_id: string | null;
  opd_nama: string | null;
  wilayah_id: string | null;
  wilayah_nama: string | null;
  wilayah_jenis: string | null;
  wilayah_legacy: string | null;
  status: string;
  instansi: string | null;
  created_at: string;
  total_count: number | string;
};

function mapUser(row: ManagedUserRpcRow): ManagedUser {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    nip: row.nip,
    username: row.username,
    namaLengkap: row.nama_lengkap,
    role: row.role,
    opdId: row.opd_id,
    opdNama: row.opd_nama,
    wilayahId: row.wilayah_id,
    wilayahNama: row.wilayah_nama,
    wilayahJenis:
      row.wilayah_jenis === "KECAMATAN" ||
      row.wilayah_jenis === "KELURAHAN"
        ? row.wilayah_jenis
        : null,
    wilayahLegacy: row.wilayah_legacy,
    status: row.status === "NONAKTIF" ? "NONAKTIF" : "AKTIF",
    instansi: row.instansi,
    createdAt: row.created_at,
  };
}

export async function getManagedUsers(filters: UserFilters = {}) {
  const supabase = createAdminClient();
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const offset = (page - 1) * USERS_PAGE_SIZE;
  const search =
    filters.search && filters.search.trim().length <= 100
      ? filters.search.trim()
      : null;

  const { data, error } = await supabase.rpc("list_managed_users", {
    p_search: search,
    p_opd_id: filters.opdId || null,
    p_wilayah_id: filters.wilayahId || null,
    p_limit: USERS_PAGE_SIZE,
    p_offset: offset,
  });

  if (error) {
    throw new Error(`Gagal mengambil pengguna: ${error.message}`);
  }

  const rows = (data ?? []) as ManagedUserRpcRow[];
  const users = rows.map(mapUser);
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));

  return {
    users,
    page,
    pageSize: USERS_PAGE_SIZE,
    total,
    totalPages,
  };
}

export async function getMasterOpdOptions(): Promise<OpdOption[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("master_opd")
    .select("id, kode_opd, nama_opd")
    .order("nama_opd", { ascending: true });

  if (error) {
    throw new Error("Gagal mengambil pilihan instansi/OPD.");
  }

  return (data ?? []).map((item) => ({
    id: item.id,
    kode: item.kode_opd,
    nama: item.nama_opd,
  }));
}

export async function getWilayahOptions(): Promise<WilayahOption[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("master_wilayah")
    .select("id, kode_wilayah, nama, jenis, parent_id")
    .in("jenis", ["KECAMATAN", "KELURAHAN"])
    .eq("is_active", true)
    .order("jenis", { ascending: true })
    .order("nama", { ascending: true });

  if (error) {
    throw new Error("Gagal mengambil pilihan wilayah.");
  }

  const parentIds = [
    ...new Set(
      (data ?? [])
        .map((item) => item.parent_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const parentNames = new Map<string, string>();

  if (parentIds.length > 0) {
    const { data: parents, error: parentError } = await supabase
      .from("master_wilayah")
      .select("id, nama")
      .in("id", parentIds);

    if (parentError) {
      throw new Error("Gagal mengambil induk wilayah.");
    }

    for (const parent of parents ?? []) {
      parentNames.set(parent.id, parent.nama);
    }
  }

  return (data ?? [])
    .filter(
      (item) => item.jenis === "KECAMATAN" || item.jenis === "KELURAHAN",
    )
    .map((item) => ({
      id: item.id,
      kode: item.kode_wilayah,
      nama: item.nama,
      jenis: item.jenis as "KECAMATAN" | "KELURAHAN",
      parentNama: item.parent_id ? (parentNames.get(item.parent_id) ?? null) : null,
    }));
}

export async function getUserById(id: string): Promise<ManagedUser | null> {
  const supabase = createAdminClient();
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select(
      "id, auth_user_id, email, nip, username, nama_lengkap, role, opd_id, wilayah_id, status, wilayah, instansi, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error("Gagal mengambil detail pengguna.");
  }

  if (!profile) {
    return null;
  }

  const [{ data: opd }, { data: wilayah }] = await Promise.all([
    profile.opd_id
      ? supabase
          .from("master_opd")
          .select("nama_opd")
          .eq("id", profile.opd_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    profile.wilayah_id
      ? supabase
          .from("master_wilayah")
          .select("nama, jenis")
          .eq("id", profile.wilayah_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return mapUser({
    ...profile,
    opd_nama: opd?.nama_opd ?? null,
    wilayah_nama: wilayah?.nama ?? null,
    wilayah_jenis: wilayah?.jenis ?? null,
    wilayah_legacy: profile.wilayah ?? null,
    total_count: 1,
  });
}
